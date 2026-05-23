#!/usr/bin/env python3
import sys
import json
import argparse

def handle_status():
    print(json.dumps({
        "ok": False,
        "status": "airllm_not_installed",
        "message": "AirLLM não instalado no venv do Ailu. Instale via painel Runtime."
    }))

def handle_generate(model, prompt):
    print(json.dumps({
        "ok": False,
        "status": "airllm_not_installed",
        "message": "Geração indisponível. AirLLM não está instalado."
    }))

def handle_benchmark(model):
    print(json.dumps({
        "ok": False,
        "status": "airllm_not_installed",
        "message": "Benchmark indisponível. AirLLM não está instalado."
    }))

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ailu Local Runtime Sidecar")
    subparsers = parser.add_subparsers(dest="command", required=True)

    status_parser = subparsers.add_parser("status")
    
    gen_parser = subparsers.add_parser("generate")
    gen_parser.add_argument("--model", required=True)
    gen_parser.add_argument("--prompt", required=True)
    
    bench_parser = subparsers.add_parser("benchmark")
    bench_parser.add_argument("--model", required=True)

    args = parser.parse_args()

    if args.command == "status":
        handle_status()
    elif args.command == "generate":
        handle_generate(args.model, args.prompt)
    elif args.command == "benchmark":
        handle_benchmark(args.model)
