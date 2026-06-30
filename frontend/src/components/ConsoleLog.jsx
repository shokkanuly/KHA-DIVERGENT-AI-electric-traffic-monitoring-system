import React, { useEffect, useRef } from 'react';

function ConsoleLog({ streamLogs }) {
    const logConsoleRef = useRef(null);

    // Scroll to bottom on new logs
    useEffect(() => {
        const consoleEl = logConsoleRef.current;
        if (consoleEl) {
            consoleEl.scrollTop = consoleEl.scrollHeight;
        }
    }, [streamLogs]);

    return (
        <div className="panel stream-panel">
            <div className="panel-header">
                <h2>FASTAPI CORE VALIDATED STREAM LOG</h2>
                <div className="stream-indicators">
                    <span className="stream-tag traffic-tag">TRAFFIC: ON</span>
                    <span className="stream-tag thermo-tag">THERMO: ON</span>
                </div>
            </div>
            <div ref={logConsoleRef} className="stream-console" id="streamLogConsole">
                {streamLogs.map((log, i) => {
                    if (log.isHtml) {
                        return (
                            <div 
                                key={i} 
                                className={`stream-line ${log.cls}`}
                                dangerouslySetInnerHTML={{ __html: log.text }}
                            />
                        );
                    }
                    return (
                        <div key={i} className={`stream-line ${log.cls}`}>
                            {log.text}
                        </div>
                    );
                })}
            </div>
            <div className="panel-footer">
                <span>ROUTER STATUS: ACTIVE</span>
                <span>BUF SIZE: OK</span>
            </div>
        </div>
    );
}

export default ConsoleLog;
