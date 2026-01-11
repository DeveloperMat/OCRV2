/**
 * Vista OCR - Manejo del DOM y renderizado de UI
 */
class OCRView {
    constructor() {
        this.singleFile = document.getElementById('singleFile');
        this.zipFile = document.getElementById('zipFile');
        this.processBtn = document.getElementById('processBtn');
        this.btnSpinner = document.getElementById('btnSpinner');
        this.btnLabel = document.getElementById('btnLabel');
        this.resultsArea = document.getElementById('resultsArea');
        this.usageCountEl = document.getElementById('usageCount');
        this.timerTextEl = document.getElementById('timerText');
        this.zipInfo = document.getElementById('zipInfo');
        this.resetBtn = document.getElementById('resetManual');
    }

    /**
     * Actualiza el contador de uso
     */
    updateUsageCount(count) {
        this.usageCountEl.textContent = count;
    }

    /**
     * Muestra/oculta el estado de carga
     */
    setLoading(isLoading) {
        this.processBtn.disabled = isLoading;
        this.btnSpinner.classList.toggle('hidden', !isLoading);
        if (!this.processBtn.classList.contains('limit-reached')) {
            this.btnLabel.textContent = isLoading ? "Analizando Factura..." : "Procesar y Generar Excel";
        }
    }

    /**
     * Habilita/deshabilita el botón de procesamiento
     */
    setButtonEnabled(enabled) {
        this.processBtn.disabled = !enabled;
        if (enabled) {
            this.processBtn.classList.remove('limit-reached');
        } else {
            this.processBtn.classList.add('limit-reached');
        }
    }

    /**
     * Muestra información del archivo ZIP
     */
    showZipInfo(validFiles) {
        this.zipInfo.textContent = `${validFiles} archivos válidos encontrados.`;
    }

    /**
     * Limpia la información del archivo ZIP
     */
    clearZipInfo() {
        this.zipInfo.textContent = '';
    }

    /**
     * Limpia el área de resultados
     */
    clearResults() {
        this.resultsArea.innerHTML = '';
    }

    /**
     * Crea una tarjeta de resultado inicial
     */
    createResultCard(filename) {
        const div = document.createElement('div');
        div.className = "bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between";
        div.innerHTML = `
            <div class="flex flex-col">
                <span class="text-xs font-bold text-slate-400 uppercase tracking-tighter mb-1">Archivo</span>
                <span class="text-sm font-semibold text-slate-800 truncate max-w-[200px]">${filename}</span>
            </div>
            <div class="flex items-center gap-4">
                <span class="status-badge text-[9px] uppercase px-2 py-1 rounded bg-slate-100 text-slate-400 font-bold">Analizando</span>
                <div class="action-area hidden"></div>
            </div>
        `;
        this.resultsArea.appendChild(div);
        return div;
    }

    /**
     * Actualiza una tarjeta con éxito
     */
    updateCardSuccess(card, data, filename, downloadCallback) {
        const badge = card.querySelector('.status-badge');
        badge.textContent = "Completado";
        badge.className = "status-badge text-[9px] uppercase px-2 py-1 rounded bg-emerald-100 text-emerald-600 font-bold";
        
        const area = card.querySelector('.action-area');
        area.classList.remove('hidden');
        area.innerHTML = ''; // Limpiar contenido anterior
        
        const btn = document.createElement('button');
        btn.className = "bg-slate-900 text-white text-[10px] py-2 px-4 rounded-lg font-bold hover:bg-blue-600 transition-all shadow-sm";
        btn.textContent = "Descargar Excel";
        btn.onclick = () => downloadCallback(data, filename);
        area.appendChild(btn);
    }

    /**
     * Actualiza una tarjeta con error
     */
    updateCardError(card, errorMessage) {
        const badge = card.querySelector('.status-badge');
        badge.textContent = "Error";
        badge.className = "status-badge text-[9px] uppercase px-2 py-1 rounded bg-red-100 text-red-600 font-bold";
    }

    /**
     * Inicia el período de espera (cooldown)
     */
    startCooldown(updateLabelCallback) {
        this.processBtn.classList.add('limit-reached');
        this.timerTextEl.classList.remove('hidden');
        this.setButtonEnabled(false);
        
        let timeLeft = 60;
        const interval = setInterval(() => {
            timeLeft--;
            this.btnLabel.textContent = `Pausa de Seguridad (${timeLeft}s)`;
            if (timeLeft <= 0) {
                clearInterval(interval);
                this.endCooldown();
                if (updateLabelCallback) updateLabelCallback();
            }
        }, 1000);
        
        return interval;
    }

    /**
     * Termina el período de espera
     */
    endCooldown() {
        this.processBtn.classList.remove('limit-reached');
        this.timerTextEl.classList.add('hidden');
        this.setButtonEnabled(true);
        this.btnLabel.textContent = "Procesar y Generar Excel";
    }

    /**
     * Muestra un mensaje de alerta
     */
    showAlert(message) {
        alert(message);
    }

    /**
     * Resetea la vista al estado inicial
     */
    reset() {
        this.updateUsageCount(0);
        this.setButtonEnabled(true);
        this.endCooldown();
        this.btnLabel.textContent = "Procesar y Generar Excel";
    }

    /**
     * Limpia los campos de archivos
     */
    clearFileInputs() {
        if (this.singleFile) this.singleFile.value = '';
        if (this.zipFile) this.zipFile.value = '';
        this.clearZipInfo();
    }

    /**
     * Obtiene referencias a los elementos del DOM
     */
    getElements() {
        return {
            singleFile: this.singleFile,
            zipFile: this.zipFile,
            processBtn: this.processBtn,
            resetBtn: this.resetBtn
        };
    }
}

