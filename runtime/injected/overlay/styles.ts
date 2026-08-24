export { RECORDING_OVERLAY_STYLES }

const RECORDING_OVERLAY_STYLES = `
  .highlight {
    background: rgb(79 155 229 / 18%);
    border: 2px solid rgb(79 155 229 / 90%);
    box-sizing: border-box;
    display: none;
    pointer-events: none;
    position: fixed;
  }

  .tooltip {
    background: #202124;
    border: 1px solid #3c4043;
    border-radius: 5px;
    box-shadow: 0 2px 8px rgb(0 0 0 / 28%);
    box-sizing: border-box;
    color: #f1f3f4;
    display: none;
    font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    max-width: min(520px, calc(100vw - 8px));
    overflow: hidden;
    padding: 5px 7px;
    pointer-events: none;
    position: fixed;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .panel {
    align-items: center;
    background: #202124;
    border: 1px solid #3c4043;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgb(0 0 0 / 28%);
    display: flex;
    font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    gap: 10px;
    padding: 8px;
    pointer-events: auto;
  }

  .status {
    align-items: center;
    color: #f1f3f4;
    display: flex;
    gap: 7px;
    padding-left: 4px;
    white-space: nowrap;
  }

  .indicator {
    background: #ea4335;
    border-radius: 50%;
    height: 8px;
    width: 8px;
  }

  button {
    all: initial;
    background: #f1f3f4;
    border-radius: 5px;
    color: #202124;
    cursor: pointer;
    font: 600 12px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    padding: 6px 10px;
    white-space: nowrap;
  }

  button:hover { background: #fff; }
  button:focus-visible { outline: 2px solid #8ab4f8; outline-offset: 2px; }
  button:disabled { cursor: default; opacity: 0.65; }
`
