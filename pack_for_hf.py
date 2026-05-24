"""
Repack the Datasets/ folder into a handful of tar archives so it uploads
to Hugging Face Hub at full bandwidth instead of one tiny file at a time.

Output: ./Datasets_packed/*.tar  (5-7 archives, total ~30 GB)

Usage:
    cd C:\\Users\\Omar\\Documents\\Claude\\Projects\\Capstone
    python pack_for_hf.py

Then:
    huggingface-cli upload <your-repo>/goldeneye-datasets Datasets_packed/ . --repo-type dataset --private
"""

from pathlib import Path
import tarfile
import time
import sys

ROOT = Path(__file__).parent / "Datasets"
OUT = Path(__file__).parent / "Datasets_packed"
OUT.mkdir(exist_ok=True)


def make_tar(name: str, source: Path, base_arcname: str | None = None):
    """Tar a folder. No compression: images are already JPEG, gzip wastes CPU.

    base_arcname controls the top-level folder name inside the tar.
    """
    if not source.exists():
        print(f"  SKIP {name}: {source} not found")
        return
    out = OUT / f"{name}.tar"
    if out.exists():
        print(
            f"  SKIP {name}: {out.name} already exists ({out.stat().st_size/1e9:.2f} GB)"
        )
        return
    t0 = time.time()
    arcname = base_arcname or source.name
    print(f"  packing {name} <- {source}")
    with tarfile.open(out, "w") as tar:
        tar.add(source, arcname=arcname)
    dt = time.time() - t0
    size_gb = out.stat().st_size / 1e9
    print(
        f"  done  {name}.tar  {size_gb:.2f} GB in {dt:.0f}s "
        f"({size_gb*1024/dt:.1f} MB/s)"
    )


def main():
    if not ROOT.exists():
        sys.exit(f"Cannot find {ROOT}")
    print(f"Packing from {ROOT}")
    print(f"Writing to   {OUT}\n")

    # One tar per top-level dataset.
    # Splitting synthetic by degradation level so any single tar stays <5 GB
    # (HF's recommended chunk size). The others fit in one each.
    make_tar("sard", ROOT / "SARD-Dataset-search-and-rescue")
    make_tar("real_data", ROOT / "real_data")
    make_tar("heridal", ROOT / "HERIDAL.yolov8")
    make_tar("doron", ROOT / "doron_parson1")

    # Synthetic gets split by degradation level since it's the largest
    # (~9.3 GB, ~60K files). Three smaller tars.
    syn = ROOT / "synthetic_data"
    if syn.exists():
        for sub in ("degradation_low", "degradation_moderate", "degradation_severe"):
            make_tar(
                f"synthetic_{sub}",
                syn / sub,
                base_arcname=f"synthetic_data/{sub}",
            )

    print("\nDone. Files in Datasets_packed/:")
    total = 0
    for p in sorted(OUT.glob("*.tar")):
        size = p.stat().st_size
        total += size
        print(f"  {p.name:40} {size/1e9:7.2f} GB")
    print(f"  {'TOTAL':40} {total/1e9:7.2f} GB")


if __name__ == "__main__":
    main()

