#!/usr/bin/env python3
"""Build the static browser-validator manifest from the released LT4CPR test data.

The output contains only public cell identities and public tweet IDs; it does not
include tweet text or organizer-only metadata.
"""
from __future__ import annotations
import argparse, json, zipfile
from pathlib import Path, PurePosixPath

EXPECTED_COUNTS = {"collapse":19,"damsafety":19,"heatwave":13,"indfire":16,"landslide":28,"tornado":22}

def names_and_reader(source: Path):
    if source.is_dir():
        names=[p.relative_to(source).as_posix() for p in source.rglob('*') if p.is_file()]
        return names, lambda n:(source/PurePosixPath(n)).read_text(encoding='utf-8'), None
    if source.is_file() and zipfile.is_zipfile(source):
        z=zipfile.ZipFile(source,'r')
        return [n for n in z.namelist() if not n.endswith('/')], lambda n:z.read(n).decode('utf-8'), z
    raise SystemExit(f"Not a directory or ZIP: {source}")

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--test-data', required=True, type=Path, help='Released test directory or ZIP')
    ap.add_argument('--out', type=Path, default=Path('submission-assets/test-manifest.json'))
    args=ap.parse_args()
    names, read, closer=names_and_reader(args.test_data)
    try:
        files=[n for n in names if n.endswith('.tweets.jsonl') and ('/test/' in f'/{n}' or n.startswith('test/'))]
        if not files:
            # Also support passing the test directory itself.
            files=[n for n in names if n.endswith('.tweets.jsonl')]
        cells={}; counts={k:0 for k in EXPECTED_COUNTS}
        for n in sorted(files):
            parts=list(PurePosixPath(n).parts)
            if 'test' in parts:
                i=parts.index('test'); rest=parts[i+1:]
            else:
                rest=parts
            if len(rest)!=2: continue
            crisis, fn=rest
            if crisis not in EXPECTED_COUNTS or not fn.endswith('.tweets.jsonl'): continue
            stem=fn[:-len('.tweets.jsonl')]
            ids=[]; seen_ids=set()
            for lineno,line in enumerate(read(n).splitlines(),1):
                if not line.strip(): continue
                obj=json.loads(line)
                if isinstance(obj,dict) and 'id' in obj and 'text' in obj and 'timestamp' in obj:
                    tid=obj['id']
                    if isinstance(tid,bool) or not isinstance(tid,int) or tid<=0:
                        raise SystemExit(f'{n}:{lineno}: invalid tweet id {tid!r}')
                    if tid in seen_ids:
                        raise SystemExit(f'{n}:{lineno}: duplicate tweet id {tid}')
                    seen_ids.add(tid); ids.append(tid)
            if not ids: raise SystemExit(f'{n}: no tweet records found')
            key=f'{crisis}/{stem}'
            if key in cells: raise SystemExit(f'duplicate cell: {key}')
            cells[key]={"crisis":crisis,"stem":stem,"tweet_ids":sorted(ids)}
            counts[crisis]+=1
        total=sum(counts.values())
        if counts != EXPECTED_COUNTS:
            raise SystemExit(f'Unexpected public test inventory: {counts}; expected {EXPECTED_COUNTS}')
        if total != 117: raise SystemExit(f'Expected 117 public cells, found {total}')
        out={"manifest_version":"1.0","generated":True,"expected_counts":EXPECTED_COUNTS,"cell_count":total,"cells":cells}
        args.out.parent.mkdir(parents=True,exist_ok=True)
        args.out.write_text(json.dumps(out,indent=2,sort_keys=True)+'\n',encoding='utf-8')
        print(f'Wrote {args.out} with {total} cells.')
    finally:
        if closer: closer.close()
if __name__=='__main__': main()
