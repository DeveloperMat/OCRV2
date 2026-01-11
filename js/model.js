/**
 * Modelo OCR - Manejo de datos y lógica de negocio
 */
class OCRModel {
    constructor() {
        this.apiKey = "AIzaSyD-TkHfsAXqtlsTdEhf_bC3ZykTmgHW_xs";
        this.LIMIT = 15;
        this.processedInCycle = 0;
        this.isLocked = false;
        this.queue = [];
        
        this.COLUMN_ORDER = [
            "codigo_articulo", 
            "nombre_articulo", 
            "precio_unitario (NETO)", 
            "cantidad", 
            "prc_descuento", 
            "monto_descuento", 
            "notas"
        ];
    }

    /**
     * Resetea el contador de procesamiento
     */
    resetCounter() {
        this.processedInCycle = 0;
        this.isLocked = false;
        return {
            processedInCycle: this.processedInCycle,
            isLocked: this.isLocked
        };
    }

    /**
     * Verifica si se puede procesar más archivos
     */
    canProcess(count) {
        if (this.isLocked) return false;
        return (this.processedInCycle + count) <= this.LIMIT;
    }

    /**
     * Incrementa el contador de procesamiento
     */
    incrementProcessed() {
        this.processedInCycle++;
        return this.processedInCycle;
    }

    /**
     * Verifica si se alcanzó el límite
     */
    hasReachedLimit() {
        return this.processedInCycle >= this.LIMIT;
    }

    /**
     * Bloquea el procesamiento
     */
    lockProcessing() {
        this.isLocked = true;
    }

    /**
     * Desbloquea el procesamiento
     */
    unlockProcessing() {
        this.isLocked = false;
    }

    /**
     * Valida un archivo ZIP y cuenta archivos válidos
     */
    async validateZip(file) {
        try {
            const zip = await JSZip.loadAsync(file);
            let validFiles = 0;
            for (let filename in zip.files) {
                if (!zip.files[filename].dir && /\.(jpe?g|png|webp|pdf)$/i.test(filename)) {
                    validFiles++;
                }
            }
            return {
                success: true,
                validFiles: validFiles,
                exceedsLimit: validFiles > this.LIMIT
            };
        } catch (err) {
            return {
                success: false,
                error: "No se pudo leer el archivo ZIP."
            };
        }
    }

    /**
     * Construye la cola de archivos a procesar
     */
    async buildQueue(singleFile, zipFile) {
        const queue = [];
        
        if (singleFile && singleFile.files[0]) {
            const f = singleFile.files[0];
            queue.push({ file: f, name: f.name, type: f.type });
        }

        if (zipFile && zipFile.files[0]) {
            const zip = await JSZip.loadAsync(zipFile.files[0]);
            for (let filename in zip.files) {
                const fileData = zip.files[filename];
                if (!fileData.dir && /\.(jpe?g|png|webp|pdf)$/i.test(filename)) {
                    const blob = await fileData.async("blob");
                    const mimeType = filename.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg';
                    queue.push({ file: blob, name: filename, type: mimeType });
                }
            }
        }

        this.queue = queue;
        return queue;
    }

    /**
     * Convierte un blob a base64
     */
    blobToBase64(blob) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.split(',')[1]);
            reader.readAsDataURL(blob);
        });
    }

    /**
     * Llama a la API de Gemini para extraer datos de la factura
     */
    async callGemini(base64, mimeType) {
        const prompt = `Analiza detalladamente la tabla de artículos de esta factura. 
            Mejora la detección analizando la relación espacial de los datos para evitar mezclar columnas.
            
            INSTRUCCIONES DE EXTRACCIÓN PRECISAS:
            1. Identifica el "Código" único del producto. 
               IMPORTANTE: Respeta literalmente cualquier espacio o separación que tenga el código original. NO elimines espacios internos si el código los tiene (Ejemplo: "ABC 123" debe quedarse como "ABC 123"). Si no existe, pon "0".
            2. Identifica el "Nombre/Descripción": es el texto principal del artículo. Asegúrate de capturar la descripción completa si ocupa varias líneas.
            3. Para "Precio Unitario": extrae el precio neto antes de impuestos. 
            4. Para "Cantidad": extrae el número de unidades.
            5. Para "Descuento": busca porcentajes o montos de descuento por ítem. Si no hay, pon "0".
            6. Verifica que el código y el nombre pertenezcan a la misma fila horizontal.
            
            REGLAS DE FORMATO:
            - codigo_articulo: Cadena de texto EXACTA y LITERAL incluyendo sus espacios originales.
            - nombre_articulo: Texto descriptivo limpio.
            - precio_unitario (NETO): SOLO números. Sin puntos de miles, usa coma para decimales. Ejemplo: "1250,00".
            - prc_descuento: El porcentaje (ej: "10") o "0" si no hay.
            - monto_descuento: Siempre "0".
            - campos vacíos: Siempre "0".
            
            Devuelve un JSON estructurado con la lista de artículos detectados.`;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${this.apiKey}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType, data: base64 } }] }],
                generationConfig: { 
                    responseMimeType: "application/json",
                    temperature: 0.1, 
                    responseSchema: {
                        type: "OBJECT",
                        properties: {
                            items: {
                                type: "ARRAY",
                                items: {
                                    type: "OBJECT",
                                    properties: {
                                        "codigo_articulo": { type: "STRING" },
                                        "nombre_articulo": { type: "STRING" },
                                        "precio_unitario (NETO)": { type: "STRING" },
                                        "cantidad": { type: "STRING" },
                                        "prc_descuento": { type: "STRING" },
                                        "monto_descuento": { type: "STRING" },
                                        "notas": { type: "STRING" }
                                    },
                                    required: ["codigo_articulo", "nombre_articulo", "precio_unitario (NETO)", "cantidad", "prc_descuento", "monto_descuento", "notas"]
                                }
                            }
                        }
                    }
                }
            })
        });

        if (!response.ok) throw new Error("Error de conexión con IA");
        const result = await response.json();
        return JSON.parse(result.candidates[0].content.parts[0].text);
    }

    /**
     * Procesa un archivo individual
     */
    async processFile(fileItem) {
        try {
            const base64 = await this.blobToBase64(fileItem.file);
            const data = await this.callGemini(base64, fileItem.type);
            
            if (!data || !data.items) {
                throw new Error("No se detectaron tablas compatibles.");
            }

            // Sanitiza los datos
            const sanitizedItems = data.items.map(item => {
                const newItem = {};
                this.COLUMN_ORDER.forEach(col => {
                    let val = (item[col] === undefined || item[col] === null || item[col] === "") ? "0" : String(item[col]);
                    
                    // Regla de limpieza solo para el precio
                    if (col === "precio_unitario (NETO)") {
                        val = val.replace(/\./g, '');
                        val = val.replace(/\s/g, ''); // En precios sí quitamos espacios por error OCR
                        val = val.replace(/\./g, ','); 
                    }
                    
                    newItem[col] = val;
                });
                return newItem;
            });

            this.incrementProcessed();
            
            return {
                success: true,
                data: { items: sanitizedItems },
                filename: fileItem.name
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                filename: fileItem.name
            };
        }
    }

    /**
     * Genera y descarga un archivo Excel
     */
    downloadExcel(data, filename) {
        const ws = XLSX.utils.json_to_sheet(data.items, { header: this.COLUMN_ORDER });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Articulos");
        XLSX.writeFile(wb, `${filename.split('.')[0]}_Articulos.xlsx`);
    }

    /**
     * Obtiene el estado actual del modelo
     */
    getState() {
        return {
            processedInCycle: this.processedInCycle,
            isLocked: this.isLocked,
            limit: this.LIMIT,
            queueLength: this.queue.length
        };
    }
}

