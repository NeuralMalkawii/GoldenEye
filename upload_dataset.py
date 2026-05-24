from pathlib import Path
from huggingface_hub import HfApi

REPO_ID = "OmarMalkawi/goldeneye-datasets"
FOLDER_PATH = Path(r"C:\Users\Omar\Documents\Claude\Projects\Capstone\Datasets")
REPO_TYPE = "dataset"


def main():
    api = HfApi()

    try:
        user = api.whoami()
        print(f"Logged in as: {user['name']}")
    except Exception:
        print("Not logged in. Run: hf auth login")
        return

    api.create_repo(
        repo_id=REPO_ID,
        repo_type=REPO_TYPE,
        exist_ok=True,
    )

    print(f"Uploading folder: {FOLDER_PATH}")
    print("This may take a long time on the first run.")

    api.upload_large_folder(
        repo_id=REPO_ID,
        repo_type=REPO_TYPE,
        folder_path=str(FOLDER_PATH),
        ignore_patterns=["*.tmp", "__pycache__/**", ".DS_Store"],
        num_workers=4,
    )

    print(f"Done: https://huggingface.co/datasets/{REPO_ID}")


if __name__ == "__main__":
    main()
