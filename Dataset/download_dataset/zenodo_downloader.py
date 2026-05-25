import os
import zipfile
import subprocess

def download_dataset_via_tool(record_id, download_dir='data'):
    # 1. Ensure the download directory exists
    if not os.path.exists(download_dir):
        os.makedirs(download_dir)
    
    # Get absolute path to avoid any ambiguity
    abs_path = os.path.abspath(download_dir)

    print(f"Paso 0: Descargando record {record_id} usando zenodo_get...")

    try:
        # We use the flags confirmed by your help menu:
        # -o : Output directory
        # -g : Glob pattern to only download the zip and metadata
        # -e : Continue on error (good for unstable connections)
        command = [
            'zenodo_get', 
            '-o', abs_path, 
            '-e',
            '-v', '3',
            '--ignore-existing-files',
            str(record_id)
        ]

        # Execute the tool
        subprocess.run(command, check=True)
        print("\nDownload finished successfully via zenodo-get.")

    except subprocess.CalledProcessError as e:
        print(f"Tool failed. Check if record ID {record_id} is correct.")
    except FileNotFoundError:
        print("zenodo_get not found. Did you run 'pip install zenodo-get'?")


def unzip_dataset(zip_path, extract_to):
    if not os.path.exists(zip_path):
        print(f"File not found: {zip_path}")
        return

    # Create the extraction directory
    if not os.path.exists(extract_to):
        os.makedirs(extract_to)

    print(f"--- Attempting extraction with 7-Zip ---")
    try:
        # 'x' means extract with full paths
        # '-o' specifies the output directory (no space after -o)
        # '-y' assumes Yes to all prompts (overwrite)
        command = ['7z', 'x', zip_path, f'-o{extract_to}', '-y']
        
        result = subprocess.run(command, capture_output=True, text=True)
        
        if result.returncode == 0:
            print(f"Successfully extracted {zip_path} to {extract_to}")
        else:
            print(f"7-Zip failed: {result.stderr}")
            # If 7-Zip fails, it's a huge sign the file is actually a 
            # partial download or an error page from Zenodo.
    except FileNotFoundError:
        print("7-Zip is not installed. Run 'sudo apt install p7zip-full'")