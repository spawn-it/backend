from fastapi import FastAPI, HTTPException
import subprocess

app = FastAPI()

@app.get("/")
def hello():
    return {"message": "FastAPI + OpenTofu ready !"}