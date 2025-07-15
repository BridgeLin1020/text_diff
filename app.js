import Tesseract from 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.esm.min.js';
import { diff_match_patch } from 'https://cdn.jsdelivr.net/npm/diff-match-patch@1.0.5/lib/diff_match_patch.js';

class OCRComparisonApp {
    constructor() {
        this.worker = null;
        this.dmp = new diff_match_patch();
        this.currentImage = null;
        this.initializeElements();
        this.setupEventListeners();
        this.initializeTesseract();
        this.updateDiff();
    }

    initializeElements() {
        this.imageInput = document.getElementById('imageInput');
        this.uploadArea = document.getElementById('uploadArea');
        this.imagePreview = document.getElementById('imagePreview');
        this.previewImg = document.getElementById('previewImg');
        this.languageSelect = document.getElementById('languageSelect');
        this.runOcrBtn = document.getElementById('runOcrBtn');
        this.progressContainer = document.getElementById('progressContainer');
        this.progressBar = document.getElementById('progressBar');
        this.progressText = document.getElementById('progressText');
        this.textA = document.getElementById('textA');
        this.textB = document.getElementById('textB');
        this.ignoreWhitespace = document.getElementById('ignoreWhitespace');
        this.ignoreSymbols = document.getElementById('ignoreSymbols');
        this.diffOutput = document.getElementById('diff-output');
        this.runOcrBtn.disabled = true;
    }

    setupEventListeners() {
        // 圖片選取按鈕
        this.imageInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                this.handleFile(e.target.files[0]);
            }
        });
        // 點擊區塊觸發 input
        this.uploadArea.addEventListener('click', () => {
            this.imageInput.click();
        });
        // 拖曳圖片上傳
        this.uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.uploadArea.classList.add('dragover');
        });
        this.uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.uploadArea.classList.remove('dragover');
        });
        this.uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.uploadArea.classList.remove('dragover');
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                this.handleFile(e.dataTransfer.files[0]);
            }
        });
        // 貼上圖片
        document.addEventListener('paste', (e) => { this.handlePaste(e); });

        // OCR 和文本輸入/比對
        this.runOcrBtn.addEventListener('click', () => this.runOCR());
        this.textA.addEventListener('input', () => this.updateDiff());
        this.textB.addEventListener('input', () => this.updateDiff());
        this.ignoreWhitespace.addEventListener('change', () => this.updateDiff());
        this.ignoreSymbols.addEventListener('change', () => this.updateDiff());
        this.languageSelect.addEventListener('change', () => {
            // 若已載入圖片可立刻重新進行 OCR
            if (this.currentImage) this.runOCR();
        });
    }

    handleFile(file) {
        if (file && file.type.startsWith('image/')) {
            this.currentImage = file;
            this.displayImage(file);
            this.runOcrBtn.disabled = false;
        } else {
            this.showError('請提供有效的圖片檔案');
        }
    }
    handlePaste(event) {
        const items = event.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.startsWith('image/')) {
                const file = items[i].getAsFile();
                if (file) {
                    event.preventDefault();
                    this.handleFile(file);
                }
                break;
            }
        }
    }

    async initializeTesseract() {
        try {
            this.worker = await Tesseract.createWorker({
                logger: (m) => {
                    if (m.status === 'recognizing text') {
                        const progress = Math.round(m.progress * 100);
                        this.progressBar.style.width = `${progress}%`;
                        this.progressText.textContent = `識別中... ${progress}%`;
                    }
                }
            });
            await this.worker.loadLanguage('eng+chi_sim+chi_tra+jpn');
            await this.worker.initialize('eng+chi_sim+chi_tra+jpn');
        } catch (error) {
            console.error('Tesseract initialization failed:', error);
            this.showError('OCR引擎初始化失敗');
        }
    }

    displayImage(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            this.previewImg.src = e.target.result;
            this.imagePreview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }

    async runOCR() {
        if (!this.currentImage) {
            this.showError('請先選擇圖片');
            return;
        }
        try {
            this.runOcrBtn.disabled = true;
            this.progressContainer.style.display = 'block';
            this.progressBar.style.width = '0%';
            this.progressText.textContent = '正在處理圖片...';
            const selectedLanguage = this.languageSelect.value;
            const { data: { text } } = await this.worker.recognize(this.currentImage, { lang: selectedLanguage });
            this.textA.value = text;
            this.updateDiff();
            this.progressText.textContent = '完成';
        } catch (error) {
            console.error('OCR 錯誤:', error);
            this.showError('OCR 識別失敗');
        } finally {
            this.runOcrBtn.disabled = false;
            setTimeout(() => { this.progressContainer.style.display = 'none'; }, 800);
        }
    }

    updateDiff() {
        let textA = this.textA.value;
        let textB = this.textB.value;
        if (this.ignoreWhitespace.checked) {
            textA = textA.replace(/\s+/g, '');
            textB = textB.replace(/\s+/g, '');
        }
        if (this.ignoreSymbols.checked) {
            textA = textA.replace(/[^\w\u4e00-\u9fff]/g, '');
            textB = textB.replace(/[^\w\u4e00-\u9fff]/g, '');
        }
        const diffs = this.dmp.diff_main(textA, textB);
        this.dmp.diff_cleanupSemantic(diffs);
        const html = this.dmp.diff_prettyHtml(diffs);
        this.diffOutput.innerHTML = html || '<span>沒有差異</span>';
    }

    showError(message) {
        alert(message);
    }
}

// DOMContentLoaded 後初始化
window.addEventListener('DOMContentLoaded', () => {
    new OCRComparisonApp();
});
