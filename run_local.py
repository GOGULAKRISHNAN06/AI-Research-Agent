import os
import sys
import subprocess
import time
import webbrowser
import socket

def is_port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('127.0.0.1', port)) == 0

def get_python_executable():
    # Detect if we have a virtual environment directory nearby
    current_dir = os.path.dirname(os.path.abspath(__file__))
    venv_dir = os.path.join(current_dir, ".venv")
    if os.path.exists(venv_dir):
        if sys.platform == "win32":
            python_bin = os.path.join(venv_dir, "Scripts", "python.exe")
        else:
            python_bin = os.path.join(venv_dir, "bin", "python")
        if os.path.exists(python_bin):
            return python_bin
    return sys.executable

def main():
    print("=" * 60)
    print("       AI Research Assistant - Local Application Starter        ")
    print("=" * 60)
    
    python_exe = get_python_executable()
    current_dir = os.path.dirname(os.path.abspath(__file__))
    print(f"[*] Python environment detected: {python_exe}")
    
    # 1. Verify/Install dependencies
    print("[*] Verifying dependencies from requirements.txt...")
    req_file = os.path.join(current_dir, "requirements.txt")
    if os.path.exists(req_file):
        try:
            subprocess.run([python_exe, "-m", "pip", "install", "-r", req_file], check=True)
            print("[+] Dependencies verified.")
        except Exception as e:
            print(f"[!] Warning: Dependencies check encountered an issue: {e}")
            print("[*] Attempting startup anyway...")
    else:
        print("[!] requirements.txt not found in root.")

    # 2. Check if port 8000 is open
    port = 8000
    if is_port_in_use(port):
        print(f"[!] Port {port} is already in use.")
        print(f"[*] Opening browser directly to http://127.0.0.1:{port}...")
        webbrowser.open(f"http://127.0.0.1:{port}")
        return

    # 3. Launch FastAPI server (Uvicorn)
    print(f"[*] Starting FastAPI uvicorn server on port {port}...")
    cmd = [python_exe, "-m", "uvicorn", "backend.main:app", "--reload", "--host", "127.0.0.1", "--port", str(port)]
    
    try:
        # Start server process
        server_process = subprocess.Popen(cmd, cwd=current_dir)
        
        # 4. Wait for server to start, then open web browser
        opened = False
        print("[*] Checking for server availability...")
        for i in range(10):
            time.sleep(1.5)
            if is_port_in_use(port):
                print(f"[+] Server started successfully on port {port}!")
                print(f"[*] Opening web browser at http://127.0.0.1:{port} ...")
                webbrowser.open(f"http://127.0.0.1:{port}")
                opened = True
                break
            print(f"    Waiting... ({i+1}/10)")
            
        if not opened:
            print("[!] Server startup ping timed out. Launching web browser anyway...")
            webbrowser.open(f"http://127.0.0.1:{port}")
            
        print("\n[+] Application running. Press Ctrl+C in this window to stop the server.")
        server_process.wait()
        
    except KeyboardInterrupt:
        print("\nStopping FastAPI server...")
        try:
            server_process.terminate()
            server_process.wait(timeout=3)
        except Exception:
            pass
        print("[+] Server stopped.")
    except Exception as e:
        print(f"[!] Failed to run server: {e}")

if __name__ == "__main__":
    main()
