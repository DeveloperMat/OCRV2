/**
 * Controlador OCR - Coordina la interacción entre Modelo y Vista
 */
class OCRController {
    constructor(model, view) {
        this.model = model;
        this.view = view;
        this.cooldownInterval = null;
        this.initializeEventListeners();
    }

    /**
     * Inicializa los event listeners
     */
    initializeEventListeners() {
        const elements = this.view.getElements();

        // Event listener para archivo ZIP
        elements.zipFile.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) {
                this.view.clearZipInfo();
                return;
            }

            const validation = await this.model.validateZip(file);
            
            if (!validation.success) {
                this.view.showAlert(validation.error);
                elements.zipFile.value = "";
                this.view.clearZipInfo();
                return;
            }

            this.view.showZipInfo(validation.validFiles);

            if (validation.exceedsLimit) {
                this.view.showAlert(`El archivo ZIP excede el límite de ${this.model.LIMIT} facturas.`);
                elements.zipFile.value = "";
                this.view.clearZipInfo();
            }
        });

        // Event listener para botón de procesamiento
        elements.processBtn.addEventListener('click', async () => {
            await this.handleProcess();
        });

        // Event listener para botón de reinicio
        elements.resetBtn.addEventListener('click', () => {
            this.handleReset();
        });
    }

    /**
     * Maneja el proceso de análisis
     */
    async handleProcess() {
        if (this.model.isLocked) return;

        const elements = this.view.getElements();
        const queue = await this.model.buildQueue(elements.singleFile, elements.zipFile);

        if (queue.length === 0) {
            this.view.showAlert("Selecciona archivos para procesar.");
            return;
        }

        if (!this.model.canProcess(queue.length)) {
            const remaining = this.model.LIMIT - this.model.processedInCycle;
            this.view.showAlert(`Límite por minuto alcanzado. Solo puedes procesar ${remaining} archivos más en este ciclo.`);
            return;
        }

        this.view.clearResults();
        await this.startProcessing();
    }

    /**
     * Inicia el procesamiento de archivos
     */
    async startProcessing() {
        this.view.setLoading(true);
        const queue = this.model.queue;

        for (const item of queue) {
            const card = this.view.createResultCard(item.name);
            
            const result = await this.model.processFile(item);
            
            if (result.success) {
                this.view.updateCardSuccess(
                    card, 
                    result.data, 
                    result.filename,
                    (data, filename) => this.model.downloadExcel(data, filename)
                );
                this.view.updateUsageCount(this.model.processedInCycle);
            } else {
                this.view.updateCardError(card, result.error);
            }
        }

        this.view.setLoading(false);

        if (this.model.hasReachedLimit()) {
            this.startCooldown();
        }
    }

    /**
     * Inicia el período de espera (cooldown)
     */
    startCooldown() {
        this.model.lockProcessing();
        
        this.cooldownInterval = this.view.startCooldown(() => {
            this.model.resetCounter();
            this.view.updateUsageCount(0);
        });
    }

    /**
     * Maneja el reinicio manual
     */
    handleReset() {
        if (this.cooldownInterval) {
            clearInterval(this.cooldownInterval);
            this.cooldownInterval = null;
        }

        const state = this.model.resetCounter();
        this.view.reset();
        this.view.updateUsageCount(state.processedInCycle);
    }
}

