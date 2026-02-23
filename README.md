# CRIFFIN -- **C**ancer **R**ecognition and **I**nterpretation: **F**oundation-based **F**eature **I**dentificatio**N**
Authors: Purin Denkawin, Wichinpong Sinchaisri, Nutchanon Yongsatianchot, Napat Angkathunyakul, Ronnachai Jaroensri
## Intro
Siriraj Hospital's pathology department sees over 40,000 surgical cases annually. Our pathologists spend up to 30 hours per week reviewing cases on top of their teaching, research, and administrative responsibilities. Burnout is inevitable, and an urgent technological solution is needed.

Several studies have demonstrated that AI can perform tasks common in a pathologist's daily workflow. However, despite clear potential to reduce this burden, a significant gap remains between technical possibility and real clinical implementation.

This project provides a web application that allows users with limited technical expertise to use natural language to build a classification workflow. The model is then used to localize histological features of interest on whole-slide images so findings can be reviewed and reported quickly. This problem is common in pathology workflows, and the potential impact of AI assistance for related pathology tasks has been demonstrated by Steiner et al. ("Impact of Deep Learning Assistance on the Histopathologic Review of Lymph Nodes for Metastatic Breast Cancer").

## Requirement
- OS: Windows, Linux, or macOS
- Python: 3.10+ (tested in this repo with Python 3.12)
- Node.js: 20+ and npm
- GPU: NVIDIA GPU recommended for practical inference speed (CPU mode may be very slow)
- CUDA/PyTorch: install a CUDA-compatible `torch` build for your environment
- OpenSlide runtime/library required for WSI formats (`.svs`, `.mrxs`, `.ndpi`)

## Setup
### 1) Backend
```bash
cd backend
python -m venv .venv
```

Activate the environment:

Windows PowerShell:
```powershell
.\.venv\Scripts\Activate.ps1
```

Linux/macOS:
```bash
source .venv/bin/activate
```

Install dependencies:
```bash
pip install --extra-index-url https://download.pytorch.org/whl torch==2.9.1+cu130
pip install -r requirements.txt
```

Optional environment variables:
- `SLIDES_DIR` (default: `slides`)
- `HF_TOKEN` (for Hugging Face model access if needed)

Run backend:
```bash
python run.py --port 8000
```

### 2) Frontend
```bash
cd frontend-2
npm install
```

Set backend URL (example):

Windows PowerShell:
```powershell
$env:NEXT_PUBLIC_SERVER_URL="http://localhost:8000"
npm run dev
```

Linux/macOS:
```bash
NEXT_PUBLIC_SERVER_URL=http://localhost:8000 npm run dev
```

### 3) Use the app
- Open `http://localhost:3000`
- Connect to backend
- Upload or select a slide
- Add query terms
- Run processing and inspect heatmap/top regions

## License
CC-BY-4.0
