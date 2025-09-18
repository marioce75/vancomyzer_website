# Simple wrapper to import the main application
try:
    from main import app
except ImportError:
    try:
        from backend.main import app
    except ImportError:
        from .main import app

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
