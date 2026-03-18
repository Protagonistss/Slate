import { useEffect, useRef, useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { ptyBridge } from '@/services/terminal';
import { useTerminalStore } from '../store';
import '@xterm/xterm/css/xterm.css';

interface TerminalInstanceProps {
  sessionId: string;
  cwd?: string;
}

export function TerminalInstance({ sessionId, cwd }: TerminalInstanceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const updateSessionStatus = useTerminalStore((s) => s.updateSessionStatus);

  const fitTerminal = useCallback(() => {
    if (fitAddonRef.current && xtermRef.current) {
      try {
        fitAddonRef.current.fit();
      } catch (e) {
        // Ignore fit errors during unmount
      }
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current || xtermRef.current) return;

    const xterm = new XTerm({
      theme: {
        background: '#0c0c0c',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        cursorAccent: '#0c0c0c',
        selectionBackground: '#264f78',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5',
      },
      fontFamily: 'Consolas, "Cascadia Code", "Fira Code", monospace',
      fontSize: 13,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: 10000,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    xterm.loadAddon(fitAddon);
    xterm.loadAddon(webLinksAddon);

    xterm.open(containerRef.current);
    xterm.focus();

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    setTimeout(fitTerminal, 0);

    ptyBridge
      .spawn({ cwd, cols: 80, rows: 24 })
      .then((session) => {
        updateSessionStatus(sessionId, 'running');

        const removeData = ptyBridge.onData(session.id, (data) => {
          xterm.write(data);
        });

        const removeExit = ptyBridge.onExit(session.id, (code) => {
          updateSessionStatus(sessionId, 'exited', code);
          xterm.write(`\r\n\x1b[33mProcess exited with code ${code}\x1b[0m\r\n`);
        });

        let lastCols: number | null = null;
        let lastRows: number | null = null;
        let raf: number | null = null;

        const syncSize = () => {
          fitTerminal();
          const dims = fitAddon.proposeDimensions();
          if (!dims) return;
          if (dims.cols === lastCols && dims.rows === lastRows) return;
          lastCols = dims.cols;
          lastRows = dims.rows;
          ptyBridge.resize(session.id, dims.cols, dims.rows).catch(() => {});
        };

        // Observe container resize (panel drag doesn't trigger window resize)
        if (containerRef.current && typeof ResizeObserver !== 'undefined') {
          const ro = new ResizeObserver(() => {
            if (raf !== null) cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => {
              raf = null;
              syncSize();
            });
          });
          ro.observe(containerRef.current);
          resizeObserverRef.current = ro;
        }

        cleanupRef.current = () => {
          if (raf !== null) cancelAnimationFrame(raf);
          resizeObserverRef.current?.disconnect();
          resizeObserverRef.current = null;
          removeData();
          removeExit();
          ptyBridge.kill(session.id).catch(() => {});
        };

        xterm.onData((data) => {
          ptyBridge.write(session.id, data).catch(() => {});
        });

        xterm.onResize(({ cols, rows }) => {
          ptyBridge.resize(session.id, cols, rows).catch(() => {});
        });

        // Initial sync after first layout
        setTimeout(syncSize, 50);
      })
      .catch((error) => {
        updateSessionStatus(sessionId, 'exited', 1);
        xterm.write(`\x1b[31mFailed to start terminal: ${error.message}\x1b[0m\r\n`);
      });

    const handleResize = () => fitTerminal();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cleanupRef.current?.();
      xterm.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, [sessionId, cwd, fitTerminal, updateSessionStatus]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full p-2 rounded-b-lg overflow-hidden"
      style={{ backgroundColor: '#0c0c0c' }}
    />
  );
}
