"""Find where a song loops, and listen to the seam before writing its marks in src/music.ts.

  onsets   <file> [--until 8]                  note starts with their strongest pitch: find the
                                               downbeat the loop should start on
  tempo    <file>                              beat-length candidates, as BPM
  seams    <file> --start 2.1:2.7 --end 110:   ranked (loop start, loop end) pairs whose next
                                               seconds sound alike, so the jump back is unheard
  preview  <file> <start> <end> [--around 4]   output/music/<song>/seam-<start>-<end>.wav: the
                                               seconds before the end, then those after the start
  analyze  <file>                              tempo, the opening onsets and the best seams

Decodes with ffmpeg (mono, 22.05 kHz). Times are seconds into the file as ffmpeg decodes it,
which is what decodeAudioData gives the game; check by ear with just dev-music. docs/audio.md.
"""
import argparse
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np

RATE = 22050
NOTES = 'C C# D D# E F F# G G# A A# B'.split()


def decode(path: Path) -> np.ndarray:
    if not shutil.which('ffmpeg'):
        sys.exit('ffmpeg is missing: brew install ffmpeg')
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-ac', '1', '-ar', str(RATE), '-f', 'f32le', '-'],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32)


def spectrum(x: np.ndarray, size: int, hop: int) -> np.ndarray:
    frames = np.lib.stride_tricks.sliding_window_view(x, size)[::hop] * np.hanning(size)
    return np.abs(np.fft.rfft(frames, axis=1))


def note(freq: float) -> str:
    midi = int(round(69 + 12 * np.log2(freq / 440)))
    return f'{NOTES[midi % 12]}{midi // 12 - 1}'


def onsets(x: np.ndarray, until: float) -> list[tuple[float, float, str]]:
    size, hop = 1024, 256
    mags = spectrum(x[: int((until + 1) * RATE)], size, hop)
    flux = np.maximum(0, np.diff(np.log1p(mags), axis=0)).sum(1)
    times = (np.arange(len(flux)) + 1) * hop / RATE
    threshold = np.median(flux) + 2 * np.std(flux)
    freqs = np.fft.rfftfreq(size, 1 / RATE)
    band = (freqs > 60) & (freqs < 2000)
    found, last = [], -1.0
    for i, value in enumerate(flux):
        if times[i] > until:
            break
        if value > threshold and value == flux[max(0, i - 3): i + 4].max() and times[i] - last > .05:
            last = times[i]
            # The pitch a few frames after the attack, once the note sounds.
            frame = mags[min(i + 5, len(mags) - 1)]
            freq = freqs[band][frame[band].argmax()]
            found.append((times[i], freq, note(freq)))
    return found


def tempo(x: np.ndarray) -> list[float]:
    hop = 256
    flux = np.maximum(0, np.diff(np.log1p(spectrum(x, 1024, hop)), axis=0)).sum(1)
    flux -= flux.mean()
    corr = np.correlate(flux, flux, 'full')[len(flux) - 1:]
    lags = np.arange(len(corr)) * hop / RATE
    useful = (lags > .25) & (lags < 1.5)
    return [float(lag) for lag in lags[useful][np.argsort(corr[useful])[::-1][:5]]]


def seams(x: np.ndarray, start: tuple[float, float], end: tuple[float, float], window: float, count: int):
    """Scores every (start, end) pair by how alike the `window` seconds after each one sound."""
    hop = 64
    fps = RATE / hop
    mags = np.log1p(spectrum(x, 2048, hop)[:, :400])
    mags /= np.linalg.norm(mags, axis=1, keepdims=True) + 1e-9
    w = int(window * fps)
    a, b = int(start[0] * fps), int(start[1] * fps)
    c, d = int(end[0] * fps), min(int(end[1] * fps), len(mags) - w)
    if b <= a or d <= c:
        sys.exit('Empty search range: check --start and --end against the song length.')
    gram = mags[a: b + w] @ mags[c: d + w].T
    score = np.zeros((b - a, d - c))
    for k in range(w):
        score += gram[k: k + b - a, k: k + d - c]
    score /= w
    picked: list[tuple[float, float, float]] = []
    for flat in np.argsort(score, axis=None)[::-1]:
        i, j = np.unravel_index(flat, score.shape)
        s, e = (a + i) / fps, (c + j) / fps
        if all(abs(e - other) > .3 for _, other, _ in picked):
            picked.append((s, e, float(score[i, j])))
        if len(picked) >= count:
            break
    return picked


def preview(path: Path, start: float, end: float, around: float) -> Path:
    out = Path('output/music') / path.stem / f'seam-{start:.3f}-{end:.3f}.wav'
    out.parent.mkdir(parents=True, exist_ok=True)
    graph = (f'[0:a]atrim=start={max(0, end - around)}:end={end},asetpts=PTS-STARTPTS[a];'
             f'[0:a]atrim=start={start}:end={start + around},asetpts=PTS-STARTPTS[b];[a][b]concat=n=2:v=0:a=1')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(path), '-filter_complex', graph, str(out)], check=True)
    return out


def span(text: str, length: float) -> tuple[float, float]:
    low, _, high = text.partition(':')
    return float(low or 0), float(high) if high else length


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest='command', required=True)
    for name in ('onsets', 'tempo', 'seams', 'preview', 'analyze'):
        command = sub.add_parser(name)
        command.add_argument('file', type=Path)
        if name == 'onsets':
            command.add_argument('--until', type=float, default=8)
        if name in ('seams', 'analyze'):
            command.add_argument('--start', help='loop start range, seconds a:b (default 0:6)')
            command.add_argument('--end', help='loop end range, seconds a:b (default the last 25 s)')
            command.add_argument('--window', type=float, default=1.6, help='seconds compared after each point')
            command.add_argument('--count', type=int, default=6)
        if name == 'preview':
            command.add_argument('start', type=float)
            command.add_argument('end', type=float)
            command.add_argument('--around', type=float, default=4)
    args = parser.parse_args()
    if not args.file.is_file():
        sys.exit(f'No such file: {args.file}')
    if args.command == 'preview':
        print(preview(args.file, args.start, args.end, args.around))
        return
    x = decode(args.file)
    length = len(x) / RATE
    if args.command in ('tempo', 'analyze'):
        print(f'{args.file} · {length:.3f} s')
        beats = tempo(x)
        print('Beat candidates: ' + ' · '.join(f'{lag:.4f} s = {60 / lag:.1f} BPM' for lag in beats))
    if args.command in ('onsets', 'analyze'):
        print('\nOnsets:')
        for time, freq, name in onsets(x, getattr(args, 'until', 8)):
            print(f'  {time:7.3f} s  {name:4s} {freq:7.1f} Hz')
    if args.command in ('seams', 'analyze'):
        start = span(args.start, length) if args.start else (0, min(6, length / 4))
        end = span(args.end, length) if args.end else (max(start[1] + 1, length - 25), length)
        print(f'\nSeams (start {start[0]:g}–{start[1]:g} s, end {end[0]:g}–{end[1]:g} s):')
        for s, e, score in seams(x, start, end, args.window, args.count):
            print(f'  start {s:8.3f}  end {e:8.3f}  loop {e - s:8.3f} s  match {score:.3f}')
        print('\nListen: just music-seam <file> <start> <end>')


if __name__ == '__main__':
    main()
