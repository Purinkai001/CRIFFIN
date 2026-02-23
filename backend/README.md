# Setup Environment

```
# Need to specify a different wheel for this version of torch,
# might also have to change CUDA version for different machines
pip install --extra-index-url https://download.pytorch.org/whl torch==2.9.1+cu130
pip install -r requirements.txt
```

# Run

- Activate environment
- Run `python run.py --port 8000` Or with uvicorn directly: `uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload`