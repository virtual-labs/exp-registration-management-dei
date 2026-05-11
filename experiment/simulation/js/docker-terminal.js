/***
 * ============================================
 * DOCKER TERMINAL MANAGER
 * ============================================
 * Manages Docker terminal functionality for managing Network Functions
 * 
 * Responsibilities:
 * - Docker compose commands (up, down, ps)
 * - Start/stop individual NFs
 * - Display service status with health indicators
 * - Watch mode for real-time status updates
 */

class DockerTerminal {
    constructor() {
        this.watchInterval = null;
        this.isWatching = false;
        this.dockerServices = new Map(); // Map of service name to status

        // Terminal window state
        this.terminalState = {
            x: null,
            y: null,
            width: 900,
            height: 700,
            isMaximized: false,
            isMinimized: false
        };

        // Network state
        this.oaiWorkshopNetworkExists = false;
        this.oaiWorkshopNetworkId = this.generateNetworkId();
        this.oaiWorkshopCreatedTime = null;

        console.log('✅ DockerTerminal initialized');
    }

    /**
     * Initialize Docker terminal button
     */
    init() {
        // Button is added in HTML, just setup click handler if needed
        console.log('✅ Docker terminal ready');
    }

    /**
     * Open Docker terminal modal
     */
    openTerminal() {
        // Remove existing terminal if any
        const existingTerminal = document.getElementById('docker-terminal-modal');
        if (existingTerminal) {
            existingTerminal.remove();
        }

        // Create terminal modal
        const terminalModal = document.createElement('div');
        terminalModal.id = 'docker-terminal-modal';
        terminalModal.className = 'docker-terminal-modal';
        terminalModal.innerHTML = `
            <div class="docker-terminal-window" id="docker-terminal-window">
                <div class="docker-terminal-titlebar" id="docker-terminal-titlebar">
                    <div class="docker-terminal-title">
                        <span class="docker-terminal-icon">🐳</span>
                        Docker Terminal
                    </div>
                    <div class="docker-terminal-controls">
                        <button class="docker-terminal-btn close" id="docker-terminal-close" title="Close">×</button>
                    </div>
                </div>
                <div class="docker-terminal-content" id="docker-terminal-content">
                    <div class="docker-terminal-output" id="docker-terminal-output"></div>
                </div>
                <div class="docker-terminal-resize-handle" id="docker-terminal-resize-handle"></div>
            </div>
        `;

        document.body.appendChild(terminalModal);

        // Setup terminal functionality
        this.setupTerminal(terminalModal);

        // Setup dragging, resizing, and window controls
        this.setupWindowControls(terminalModal);

        // Apply saved position and size
        this.applyTerminalState();

        // Show terminal with animation
        setTimeout(() => {
            terminalModal.classList.add('show');
        }, 10);
    }

    /**
     * Setup Docker terminal functionality
     * @param {HTMLElement} terminalModal - Terminal modal element
     */
    setupTerminal(terminalModal) {
        const output = document.getElementById('docker-terminal-output');
        const content = document.getElementById('docker-terminal-content');
        const closeBtn = document.getElementById('docker-terminal-close');

        let commandHistory = [];
        let historyIndex = -1;
        let currentInput = null;
        let currentInputLine = null;

        // Close button
        closeBtn.addEventListener('click', () => {
            this.stopWatch();
            terminalModal.classList.remove('show');
            setTimeout(() => {
                terminalModal.remove();
            }, 300);
        });

        // Click outside to close
        terminalModal.addEventListener('click', (e) => {
            if (e.target === terminalModal) {
                closeBtn.click();
            }
        });

        // Focus on terminal click
        content.addEventListener('click', (e) => {
            if (currentInput && !this.isWatching) {
                currentInput.focus();
            }
        });

        // Create input line
        const createInputLine = () => {
            // Remove existing input line if any
            if (currentInputLine) {
                currentInputLine.remove();
            }

            // Create new input line
            const inputLine = document.createElement('div');
            inputLine.className = 'docker-terminal-input-line';
            inputLine.innerHTML = `
                <span class="docker-terminal-prompt">docker@main$</span>
                <input type="text" class="docker-terminal-input" autocomplete="off" spellcheck="false">
            `;
            output.appendChild(inputLine);
            
            currentInputLine = inputLine;
            currentInput = inputLine.querySelector('.docker-terminal-input');
            
            // Setup input event handlers
            currentInput.addEventListener('keydown', handleInputKeydown);
            
            // Focus the input
            currentInput.focus();
            
            // Scroll to bottom
            content.scrollTop = content.scrollHeight;
            
            return currentInput;
        };

        // Global Ctrl+C handler on the content area to stop watch mode
        content.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'c' && this.isWatching) {
                e.preventDefault();
                this.stopWatch();
                this.addTerminalLine(output, '^C', 'docker-terminal-command');
                this.addTerminalLine(output, 'Watch mode stopped.', 'info');
                this.addTerminalLine(output, '', 'blank');
                createInputLine();
            }
        });

        // Handle input keydown events
        const handleInputKeydown = async (e) => {
            // Handle Ctrl+C to stop watch mode (fallback via input)
            if (e.ctrlKey && e.key === 'c' && this.isWatching) {
                e.preventDefault();
                this.stopWatch();
                this.addTerminalLine(output, '', 'blank');
                this.addTerminalLine(output, 'Watch mode stopped.', 'info');
                this.addTerminalLine(output, '', 'blank');
                createInputLine();
                return;
            }

            if (e.key === 'Enter') {
                const command = e.target.value.trim();
                
                // Move input line content to output as a regular line
                const commandLine = document.createElement('div');
                commandLine.className = 'docker-terminal-line docker-terminal-command';
                commandLine.textContent = `docker@main${e.target.value}`;
                
                // Replace input line with command line
                if (currentInputLine) {
                    currentInputLine.replaceWith(commandLine);
                }
                
                currentInputLine = null;
                currentInput = null;
                
                if (command) {
                    // Add to history
                    commandHistory.push(command);
                    historyIndex = commandHistory.length;

                    // Process command
                    await this.processCommand(command, output, content, createInputLine);
                }
                
                // Create new input line after command execution
                if (!this.isWatching) {
                    createInputLine();
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (historyIndex > 0) {
                    historyIndex--;
                    e.target.value = commandHistory[historyIndex];
                    // Move cursor to end
                    setTimeout(() => {
                        e.target.setSelectionRange(e.target.value.length, e.target.value.length);
                    }, 0);
                }
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (historyIndex < commandHistory.length - 1) {
                    historyIndex++;
                    e.target.value = commandHistory[historyIndex];
                } else {
                    historyIndex = commandHistory.length;
                    e.target.value = '';
                }
                        } else if (e.key === 'Tab') {
                e.preventDefault();
                const val = e.target.value;
                if (!val.length) return;

                const commands = [
                    'help', 'status', 'check', 'cls', 'clear', 'exit', 'ls',
                    'vi docker-compose.yml',
                    'docker ps',
                    'docker version',
                    'docker network ls',
                    'docker network inspect bridge',
                    'docker network inspect host',
                    'docker network inspect none',
                    'docker network inspect oaiworkshop',
                    'docker start ',
                    'docker stop ',
                    'docker compose -f docker-compose.yml up -d',
                    'docker compose -f docker-compose.yml down',
                    'docker compose -f docker-compose.yml up -d oai-nrf',
                    'docker compose -f docker-compose.yml up -d oai-amf',
                    'docker compose -f docker-compose.yml up -d oai-smf',
                    'docker compose -f docker-compose.yml up -d oai-upf',
                    'docker compose -f docker-compose.yml up -d oai-ausf',
                    'docker compose -f docker-compose.yml up -d oai-udm',
                    'docker compose -f docker-compose.yml up -d oai-udr',
                    'docker compose -f docker-compose.yml up -d mysql',
                    'docker compose -f docker-compose.yml down oai-nrf',
                    'docker compose -f docker-compose.yml down oai-amf',
                    'docker compose -f docker-compose.yml down oai-smf',
                    'docker compose -f docker-compose.yml down oai-upf',
                    'docker compose -f docker-compose.yml down oai-ausf',
                    'docker compose -f docker-compose.yml down oai-udm',
                    'docker compose -f docker-compose.yml down oai-udr',
                    'docker compose -f docker-compose.yml down mysql',
                    'docker compose -f docker-compose-gnb.yml up -d',
                    'docker compose -f docker-compose-gnb.yml down',
                    'docker compose -f docker-compose-ue.yml up -d',
                    'docker compose -f docker-compose-ue.yml down',
                    'docker compose -f docker-compose-ran.yml up -d oai-ue1',
                    'docker compose -f docker-compose-ran.yml up -d oai-ue2',
                    'docker-compose -f docker-compose.yml up -d',
                    'docker-compose -f docker-compose.yml down',
                    'watch docker compose -f docker-compose.yml ps -a',
                ];

                                const matches = commands.filter(c => c.toLowerCase().startsWith(val.toLowerCase()));

                if (matches.length === 0) {
                    e.target.style.opacity = '0.3';
                    setTimeout(() => { e.target.style.opacity = '1'; }, 120);
                } else if (matches.length === 1) {
                    e.target.value = matches[0];
                } else {
                    const lcp = matches.reduce((prefix, cmd) => {
                        let i = 0;
                        while (i < prefix.length && i < cmd.length &&
                               prefix[i].toLowerCase() === cmd[i].toLowerCase()) i++;
                        return prefix.slice(0, i);
                    });

                    if (lcp.length > val.length) {
                        e.target.value = lcp;
                    } else {
                        const cmdLine = document.createElement('div');
                        cmdLine.className = 'docker-terminal-line docker-terminal-command';
                        cmdLine.textContent = 'r:/home/user/oai-cn5g#' + val;
                        if (currentInputLine) currentInputLine.replaceWith(cmdLine);
                        currentInputLine = null;
                        currentInput = null;

                        const nextTokens = [...new Set(matches.map(m => {
                            const rest = m.slice(val.length);
                            const nextWord = rest.trimStart().split(' ')[0];
                            return nextWord || rest.trim();
                        }).filter(Boolean))];

                        const colW = Math.max(...nextTokens.map(t => t.length)) + 4;
                        const cols = Math.max(1, Math.floor(88 / colW));
                        for (let i = 0; i < nextTokens.length; i += cols) {
                            const row = nextTokens.slice(i, i + cols).map(t => t.padEnd(colW)).join('');
                            this.addTerminalLine(output, row, 'info');
                        }

                        createInputLine();
                        currentInput.value = val;
                    }
                }
            }
        };

        // Initial welcome message
        this.addTerminalLine(output, '5G WIRELESS LAB', 'info');
        this.addTerminalLine(output, 'Type "help" for available commands.', 'info');
        this.addTerminalLine(output, '', 'blank');
        
        // Create initial input line
        createInputLine();
    }

    /**
     * Process Docker command
     * @param {string} command - Command to process
     * @param {HTMLElement} output - Output element
     * @param {HTMLElement} content - Content container element
     * @param {Function} createInputLine - Function to create new input line
     */
    async processCommand(command, output, content, createInputLine) {
        const cmd = command.toLowerCase().trim();
        const args = command.split(' ');

        if (cmd === 'help' || cmd === '?') {
            this.showHelp(output);
        } else if (cmd === 'status' || cmd === 'check') {
            this.checkSystemStatus(output);
        } else if (cmd === 'docker compose -f docker-compose.yml up -d' || cmd === 'docker-compose -f docker-compose.yml up -d' ||
                   cmd === 'docker compose up -d' ||
                   cmd === 'docker-compose up -d') {
            await this.dockerComposeUp(output);
        } else if (cmd === 'docker compose -f docker-compose-gnb.yml up -d' || 
                   cmd === 'docker-compose -f docker-compose-gnb.yml up -d') {
            await this.dockerComposeGnbUp(output);
        } else if (cmd === 'docker compose -f docker-compose-ue.yml up -d' || 
                   cmd === 'docker-compose -f docker-compose-ue.yml up -d') {
            await this.dockerComposeUeUp(output);
        } else if (cmd === 'docker compose -f docker-compose-ran.yml up -d oai-ue1' || 
                   cmd === 'docker-compose -f docker-compose-ran.yml up -d oai-ue1') {
            await this.dockerComposeUe1Up(output);
        } else if (cmd === 'docker compose -f docker-compose-ran.yml up -d oai-ue2' || 
                   cmd === 'docker-compose -f docker-compose-ran.yml up -d oai-ue2') {
            await this.dockerComposeUe2Up(output);
        } else if (cmd === 'docker ps') {
            await this.dockerPS(output);
        } else if (cmd === 'docker network ls') {
            this.dockerNetworkLS(output);
        } else if (cmd.startsWith('docker network inspect ')) {
            const networkName = args.slice(3).join(' ');
            this.dockerNetworkInspect(networkName, output);
        } else if (cmd === 'docker version') {
            this.dockerVersion(output);
        } else if (cmd.startsWith('watch docker compose -f docker-compose.yml ps -a') ||
                   cmd.startsWith('watch docker-compose -f docker-compose.yml ps -a') ||
                   cmd.startsWith('watch docker compose ps -a')) {
            this.startWatch(output);
        } else if (cmd === 'docker compose -f docker-compose.yml down' ||
                   cmd === 'docker-compose -f docker-compose.yml down' ||
                   cmd === 'docker compose down' ||
                   cmd === 'docker-compose down') {
            await this.dockerComposeDown(output);
        } else if (cmd === 'docker compose -f docker-compose-gnb.yml down' ||
                   cmd === 'docker-compose -f docker-compose-gnb.yml down') {
            await this.dockerComposeGnbDown(output);
        } else if (cmd === 'docker compose -f docker-compose-ue.yml down' ||
                   cmd === 'docker-compose -f docker-compose-ue.yml down') {
            await this.dockerComposeUeDown(output);
        } else if (/^docker(-| )compose -f docker-compose\.yml down \S+/.test(cmd)) {
            // docker compose -f docker-compose.yml down <service>
            const serviceName = args[args.length - 1];
            await this.dockerComposeSingleDown(serviceName, output);
        } else if (/^docker(-| )compose -f docker-compose\.yml up -d \S+/.test(cmd)) {
            // docker compose -f docker-compose.yml up -d <service>
            const serviceName = args[args.length - 1];
            await this.dockerComposeSingleUp(serviceName, output);
        } else if (cmd.startsWith('docker start ')) {
            const serviceName = args.slice(2).join(' ');
            await this.dockerStart(serviceName, output);
        } else if (cmd.startsWith('docker stop ')) {
            const serviceName = args.slice(2).join(' ');
            await this.dockerStop(serviceName, output);
        } else if (cmd === 'cls' || cmd === 'clear') {
            output.innerHTML = '';
        } else if (cmd === 'ls') {
            this.lsCommand(output);
        } else if (cmd === 'vi docker-compose.yml' || cmd === 'vim docker-compose.yml') {
            this.viDockerCompose(output, content, createInputLine);
            return; // vi handles its own input line creation
        } else if (cmd === 'exit') {
            const closeBtn = document.getElementById('docker-terminal-close');
            if (closeBtn) closeBtn.click();
        } else {
            this.addTerminalLine(output, `Command not found: ${command}`, 'error');
            this.addTerminalLine(output, 'Type "help" for available commands.', 'info');
        }

        this.addTerminalLine(output, '', 'blank');
    }

    /**
     * Check system status
     * @param {HTMLElement} output - Output element
     */
    checkSystemStatus(output) {
        this.addTerminalLine(output, 'System Status Check:', 'info');
        this.addTerminalLine(output, '', 'blank');

        // Check dataStore
        if (window.dataStore) {
            this.addTerminalLine(output, '✅ DataStore: Available', 'success');
            const allNFs = window.dataStore.getAllNFs() || [];
            this.addTerminalLine(output, `   Found ${allNFs.length} Network Function(s)`, 'info');

            if (allNFs.length > 0) {
                this.addTerminalLine(output, '', 'blank');
                this.addTerminalLine(output, 'Network Functions:', 'info');
                allNFs.forEach(nf => {
                    const status = nf.status || 'unknown';
                    const statusColor = status === 'stable' ? 'success' : (status === 'starting' ? 'warning' : 'info');
                    this.addTerminalLine(output, `  - ${nf.name} (${nf.type}): ${status}`, statusColor);
                });
            }
        } else {
            this.addTerminalLine(output, '❌ DataStore: Not available', 'error');
        }

        this.addTerminalLine(output, '', 'blank');

        // Check other managers
        if (window.nfManager) {
            this.addTerminalLine(output, '✅ NFManager: Available', 'success');
        } else {
            this.addTerminalLine(output, '❌ NFManager: Not available', 'error');
        }

        if (window.canvasRenderer) {
            this.addTerminalLine(output, '✅ CanvasRenderer: Available', 'success');
        } else {
            this.addTerminalLine(output, '❌ CanvasRenderer: Not available', 'error');
        }
    }

    /**
     * Show help
     * @param {HTMLElement} output - Output element
     */
    showHelp(output) {
        const helpText = [
            'Available Commands:',
            '',
            '  docker compose -f docker-compose.yml up -d',
            '    Start all Core Network Functions',
            '',
            '  docker compose -f docker-compose-gnb.yml up -d',
            '    Start gNB container',
            '',
            '  docker compose -f docker-compose-ue.yml up -d',
            '    Start both UE containers',
            '',
            '  docker compose -f docker-compose-ran.yml up -d oai-ue1',
            '    Start UE1 only',
            '',
            '  docker compose -f docker-compose-ran.yml up -d oai-ue2',
            '    Start UE2 only',
            '',
            '  docker ps',
            '    Show running containers',
            '',
            '  docker network ls',
            '    List Docker networks',
            '',
            '  docker network inspect <network-name>',
            '    Inspect a network (bridge, host, none, oaiworkshop)',
            '',
            '  docker version',
            '    Show Docker version',
            '',
            '  watch docker compose -f docker-compose.yml ps -a',
            '    Watch service status (Ctrl+C to stop)',
            '',
            '  docker compose -f docker-compose.yml down',
            '    Stop all core network services',
            '',
            '  docker compose -f docker-compose.yml down <service>',
            '    Remove a single NF (e.g. oai-upf)',
            '',
            '  docker compose -f docker-compose.yml up -d <service>',
            '    Re-add a single NF after it was removed',
            '',
            '  docker compose -f docker-compose-gnb.yml down',
            '    Stop gNB container',
            '',
            '  docker compose -f docker-compose-ue.yml down',
            '    Stop all UE containers',
            '',
            '  docker start <service-name>',
            '    Start a stopped service (dot turns green)',
            '',
            '  docker stop <service-name>',
            '    Stop a running service (dot turns red)',
            '',
            '  ls',
            '    List files in current directory',
            '',
            '  vi docker-compose.yml',
            '    View docker-compose.yml (read-only, press :q to exit)',
            '',
            '  cls / clear',
            '    Clear terminal screen',
            '',
            '  status / check',
            '    Check system status',
            '',
            '  exit',
            '    Close the terminal',
            ''
        ];

        helpText.forEach(line => {
            this.addTerminalLine(output, line, 'info');
        });
    }

    /**
 * Execute docker compose up -d (start all NFs)
 * @param {HTMLElement} output - Output element
 */
async dockerComposeUp(output) {
    // Check if dataStore is available
    if (!window.dataStore) {
        this.addTerminalLine(output, 'Error: DataStore not initialized. Please refresh the page.', 'error');
        console.error('❌ DataStore not available');
        return;
    }

    // Check if NFManager is available
    if (!window.nfManager) {
        this.addTerminalLine(output, 'Error: NFManager not initialized. Please refresh the page.', 'error');
        console.error('❌ NFManager not available');
        return;
    }

    // STEP 1: Clean up existing core NFs first - prevents "only starting manually deployed NF" issue
    const existingNFs = window.dataStore.getAllNFs() || [];
    const coreNFsToRemove = existingNFs.filter(nf => nf.type !== 'gNB' && nf.type !== 'UE');
    
    if (coreNFsToRemove.length > 0) {
        this.addTerminalLine(output, `[+] Cleaning up ${coreNFsToRemove.length} existing core network service(s)...`, 'warning');
        
        for (const nf of coreNFsToRemove) {
            // Remove NF but DON'T touch buses
            if (window.nfManager) {
                window.nfManager.deleteNetworkFunction(nf.id, { preserveBuses: true });
            } else {
                window.dataStore.removeNF(nf.id);
            }
            await this.delay(50);
        }
        this.addTerminalLine(output, ' ✔ Cleanup complete', 'success');
        this.addTerminalLine(output, '', 'blank');
    }

    // STEP 2: Load topology from one-click.json
    let allNFs = [];
    try {
        const response = await fetch('../one-click.json');
        if (!response.ok) {
            throw new Error(`Failed to load one-click.json: ${response.statusText}`);
        }

        const topology = await response.json();
        const filteredTopology = this.filterTopology(topology);

        // Set creation timestamps for all NFs before import
        const importTime = Date.now();
        if (filteredTopology.nfs && Array.isArray(filteredTopology.nfs)) {
            filteredTopology.nfs.forEach(nf => {
                nf.createdAt = importTime;
                nf.status = 'starting'; // Set initial status
            });
        }

        window.dataStore.importData(filteredTopology);

        // Load icon images and trigger logs for NFs
        if (filteredTopology.nfs && Array.isArray(filteredTopology.nfs)) {
            for (const nf of filteredTopology.nfs) {
                if (nf.type === 'gNB' || nf.type === 'UE') continue;

                // Load icon image
                if (nf.icon && !nf.iconImage) {
                    const img = new Image();
                    img.onload = () => {
                        nf.iconImage = img;
                        if (window.canvasRenderer) {
                            window.canvasRenderer.render();
                        }
                    };
                    img.onerror = () => {
                        console.warn(`Failed to load icon for ${nf.name}: ${nf.icon}`);
                    };
                    img.src = nf.icon;
                }

                // Trigger log engine
                if (window.logEngine) {
                    const importedNF = window.dataStore.getNFById(nf.id);
                    if (importedNF) {
                        window.logEngine.onNFAdded(importedNF);
                    }
                }
            }
        }

        allNFs = window.dataStore.getAllNFs().filter(nf => nf.type !== 'gNB' && nf.type !== 'UE');

        if (window.canvasRenderer) {
            window.canvasRenderer.render();
        }
    } catch (error) {
        this.addTerminalLine(output, `❌ Failed to load topology: ${error.message}`, 'error');
        this.addTerminalLine(output, 'Falling back to default NF creation...', 'warning');
        this.addTerminalLine(output, '', 'blank');
        await this.createDefaultNFs(output);
        allNFs = window.dataStore.getAllNFs().filter(nf => nf.type !== 'gNB' && nf.type !== 'UE');
    }

    // Show Docker Compose style output
    this.addTerminalLine(output, `[+] Running ${allNFs.length + 1}/${allNFs.length + 1}`, 'info');

    // Create network
    this.addTerminalLine(output, ' ✔ Network oaiworkshop Created' + ' '.repeat(20) + '0.2s', 'success');
    this.oaiWorkshopNetworkExists = true;
    this.oaiWorkshopCreatedTime = Date.now();
    await this.delay(200);

    // Start each NF with Docker Compose format
    for (const nf of allNFs) {
        if (nf.type === 'gNB' || nf.type === 'UE') continue;

        const freshNF = window.dataStore.getNFById(nf.id);
        if (!freshNF) continue;

        if (!freshNF.createdAt) {
            freshNF.createdAt = Date.now();
        }

        const serviceNameMap = {
            'AMF': 'oai-amf', 'SMF': 'oai-smf', 'UPF': 'oai-upf', 'AUSF': 'oai-ausf',
            'UDM': 'oai-udm', 'UDR': 'oai-udr', 'NRF': 'oai-nrf', 'PCF': 'oai-pcf',
            'NSSF': 'oai-nssf', 'MySQL': 'mysql', 'ext-dn': 'oai-ext-dn'
        };
        const serviceName = serviceNameMap[freshNF.type] || freshNF.type.toLowerCase();

        const randomDelay = (Math.random() * 1.5 + 0.8).toFixed(1);
        this.addTerminalLine(output, ` ✔ Container ${serviceName.padEnd(16)} Started${' '.repeat(20)}${randomDelay}s`, 'success');
        await this.delay(parseFloat(randomDelay) * 1000);

        freshNF.status = 'starting';
        freshNF.statusTimestamp = Date.now();
        if (!freshNF.createdAt) {
            freshNF.createdAt = Date.now();
        }
        window.dataStore.updateNF(freshNF.id, freshNF);

        if (window.logEngine) {
            window.logEngine.addLog(freshNF.id, 'INFO', `${freshNF.name} starting via docker compose`, {
                ipAddress: freshNF.config.ipAddress,
                port: freshNF.config.port,
                protocol: freshNF.config.httpProtocol,
                status: 'starting',
                source: 'docker-compose'
            });
        }

        setTimeout(() => {
            const updatedNF = window.dataStore?.getNFById(freshNF.id);
            if (updatedNF) {
                updatedNF.status = 'stable';
                updatedNF.statusTimestamp = Date.now();
                if (!updatedNF.createdAt && freshNF.createdAt) {
                    updatedNF.createdAt = freshNF.createdAt;
                }
                window.dataStore.updateNF(updatedNF.id, updatedNF);

                if (window.logEngine) {
                    window.logEngine.addLog(updatedNF.id, 'SUCCESS', `${updatedNF.name} is now STABLE and ready for connections`, {
                        previousStatus: 'starting',
                        newStatus: 'stable',
                        uptime: '5 seconds',
                        readyForConnections: true
                    });
                }

                if (window.canvasRenderer) {
                    window.canvasRenderer.render();
                }
            }
        }, 5000);
    }

    this.addTerminalLine(output, '', 'blank');

    if (window.canvasRenderer) {
        window.canvasRenderer.render();
    }
}

    /**
     * Execute docker compose -f docker-compose-gnb.yml up -d (start gNB)
     * @param {HTMLElement} output - Output element
     */
    async dockerComposeGnbUp(output) {
        this.addTerminalLine(output, 'WARN[0000] No services to build', 'warning');
        this.addTerminalLine(output, 'WARN[0000] Found orphan containers ([oai-upf oai-smf oai-amf oai-ausf oai-udm oai-udr mysql oai-nrf oai-ext-dn]) for this project. If you removed or renamed this service in your compose file, you can run this command with the --remove-orphans flag to clean it up.', 'warning');
        this.addTerminalLine(output, '[+] up 1/1', 'info');

        // Check if gNB already exists
        const allNFs = window.dataStore?.getAllNFs() || [];
        let gnb = allNFs.find(nf => nf.type === 'gNB');

        if (!gnb && window.nfManager) {
            // Create gNB if it doesn't exist
            const position = window.nfManager.calculateAutoPosition('gNB', 1);
            gnb = window.nfManager.createNetworkFunction('gNB', position);
            
            if (gnb) {
                gnb.createdAt = Date.now();
                gnb.status = 'starting';
                gnb.statusTimestamp = Date.now();
                window.dataStore.updateNF(gnb.id, gnb);
            }
        }

        const randomDelay = (Math.random() * 0.3 + 0.1).toFixed(1);
        this.addTerminalLine(output, `✔ Container oai-gnb Created${' '.repeat(20)}${randomDelay}s`, 'success');
        await this.delay(parseFloat(randomDelay) * 1000);

        if (gnb) {
            // Set to stable after 5 seconds
            setTimeout(() => {
                const updatedGnb = window.dataStore?.getNFById(gnb.id);
                if (updatedGnb) {
                    updatedGnb.status = 'stable';
                    updatedGnb.statusTimestamp = Date.now();
                    window.dataStore.updateNF(updatedGnb.id, updatedGnb);

                    if (window.logEngine) {
                        window.logEngine.addLog(updatedGnb.id, 'SUCCESS', `${updatedGnb.name} is now STABLE and ready`, {
                            previousStatus: 'starting',
                            newStatus: 'stable',
                            uptime: '5 seconds'
                        });
                    }

                    if (window.canvasRenderer) {
                        window.canvasRenderer.render();
                    }
                }
            }, 5000);
        }

        if (window.canvasRenderer) {
            window.canvasRenderer.render();
        }
    }

    /**
     * Execute docker compose -f docker-compose-ue.yml up -d (start both UEs)
     * @param {HTMLElement} output - Output element
     */
    async dockerComposeUeUp(output) {
        this.addTerminalLine(output, 'WARN[0000] No services to build', 'warning');
        this.addTerminalLine(output, 'WARN[0000] Found orphan containers ([oai-upf oai-smf oai-amf oai-ausf oai-udm oai-udr mysql oai-nrf oai-ext-dn]) for this project. If you removed or renamed this service in your compose file, you can run this command with the --remove-orphans flag to clean it up.', 'warning');
        this.addTerminalLine(output, '[+] up 2/2', 'info');

        const allNFs = window.dataStore?.getAllNFs() || [];
        const ueTypes = ['UE', 'UE']; // Two UEs
        const ueNames = ['oai-ue1', 'oai-ue2'];
        const createdUEs = [];

        for (let i = 0; i < 2; i++) {
            let ue = allNFs.find(nf => nf.type === 'UE' && nf.name === `UE-${i + 1}`);

            if (!ue && window.nfManager) {
                const position = window.nfManager.calculateAutoPosition('UE', i + 1);
                ue = window.nfManager.createNetworkFunction('UE', position);
                
                if (ue) {
                    ue.name = `UE-${i + 1}`;
                    ue.createdAt = Date.now();
                    ue.status = 'starting';
                    ue.statusTimestamp = Date.now();
                    window.dataStore.updateNF(ue.id, ue);
                    createdUEs.push(ue);
                }
            } else if (ue) {
                createdUEs.push(ue);
            }

            const randomDelay = (Math.random() * 0.2 + 0.1).toFixed(1);
            this.addTerminalLine(output, `✔ Container ${ueNames[i]} Created${' '.repeat(20)}${randomDelay}s`, 'success');
            await this.delay(parseFloat(randomDelay) * 1000);
        }

        // Set UEs to stable after 5 seconds
        createdUEs.forEach(ue => {
            setTimeout(() => {
                const updatedUe = window.dataStore?.getNFById(ue.id);
                if (updatedUe) {
                    updatedUe.status = 'stable';
                    updatedUe.statusTimestamp = Date.now();
                    window.dataStore.updateNF(updatedUe.id, updatedUe);

                    if (window.logEngine) {
                        window.logEngine.addLog(updatedUe.id, 'SUCCESS', `${updatedUe.name} is now STABLE and ready`, {
                            previousStatus: 'starting',
                            newStatus: 'stable',
                            uptime: '5 seconds'
                        });
                    }

                    if (window.canvasRenderer) {
                        window.canvasRenderer.render();
                    }
                }
            }, 5000);
        });

        if (window.canvasRenderer) {
            window.canvasRenderer.render();
        }
    }

    /**
     * Execute docker compose -f docker-compose-ran.yml up -d oai-ue1 (start UE1 only)
     * @param {HTMLElement} output - Output element
     */
    async dockerComposeUe1Up(output) {
        this.addTerminalLine(output, 'WARN[0000] No services to build', 'warning');
        this.addTerminalLine(output, 'WARN[0000] Found orphan containers ([oai-upf oai-smf oai-amf oai-ausf oai-udm oai-udr mysql oai-nrf oai-ext-dn]) for this project. If you removed or renamed this service in your compose file, you can run this command with the --remove-orphans flag to clean it up.', 'warning');
        this.addTerminalLine(output, '[+] up 1/1', 'info');

        const allNFs = window.dataStore?.getAllNFs() || [];
        let ue1 = allNFs.find(nf => nf.type === 'UE' && nf.name === 'UE-1');

        if (!ue1 && window.nfManager) {
            const position = window.nfManager.calculateAutoPosition('UE', 1);
            ue1 = window.nfManager.createNetworkFunction('UE', position);
            
            if (ue1) {
                ue1.name = 'UE-1';
                ue1.createdAt = Date.now();
                ue1.status = 'starting';
                ue1.statusTimestamp = Date.now();
                window.dataStore.updateNF(ue1.id, ue1);
            }
        }

        const randomDelay = (Math.random() * 0.2 + 0.1).toFixed(1);
        this.addTerminalLine(output, `✔ Container oai-ue1 Created${' '.repeat(20)}${randomDelay}s`, 'success');
        await this.delay(parseFloat(randomDelay) * 1000);

        if (ue1) {
            setTimeout(() => {
                const updatedUe = window.dataStore?.getNFById(ue1.id);
                if (updatedUe) {
                    updatedUe.status = 'stable';
                    updatedUe.statusTimestamp = Date.now();
                    window.dataStore.updateNF(updatedUe.id, updatedUe);

                    if (window.logEngine) {
                        window.logEngine.addLog(updatedUe.id, 'SUCCESS', `${updatedUe.name} is now STABLE and ready`, {
                            previousStatus: 'starting',
                            newStatus: 'stable',
                            uptime: '5 seconds'
                        });
                    }

                    if (window.canvasRenderer) {
                        window.canvasRenderer.render();
                    }
                }
            }, 5000);
        }

        if (window.canvasRenderer) {
            window.canvasRenderer.render();
        }
    }

    /**
     * Execute docker compose -f docker-compose-ran.yml up -d oai-ue2 (start UE2 only)
     * @param {HTMLElement} output - Output element
     */
    async dockerComposeUe2Up(output) {
        this.addTerminalLine(output, 'WARN[0000] No services to build', 'warning');
        this.addTerminalLine(output, 'WARN[0000] Found orphan containers ([oai-upf oai-smf oai-amf oai-ausf oai-udm oai-udr mysql oai-nrf oai-ext-dn]) for this project. If you removed or renamed this service in your compose file, you can run this command with the --remove-orphans flag to clean it up.', 'warning');
        this.addTerminalLine(output, '[+] up 1/1', 'info');

        const allNFs = window.dataStore?.getAllNFs() || [];
        let ue2 = allNFs.find(nf => nf.type === 'UE' && nf.name === 'UE-2');

        if (!ue2 && window.nfManager) {
            const position = window.nfManager.calculateAutoPosition('UE', 2);
            ue2 = window.nfManager.createNetworkFunction('UE', position);
            
            if (ue2) {
                ue2.name = 'UE-2';
                ue2.createdAt = Date.now();
                ue2.status = 'starting';
                ue2.statusTimestamp = Date.now();
                window.dataStore.updateNF(ue2.id, ue2);
            }
        }

        const randomDelay = (Math.random() * 0.2 + 0.1).toFixed(1);
        this.addTerminalLine(output, `✔ Container oai-ue2 Created${' '.repeat(20)}${randomDelay}s`, 'success');
        await this.delay(parseFloat(randomDelay) * 1000);

        if (ue2) {
            setTimeout(() => {
                const updatedUe = window.dataStore?.getNFById(ue2.id);
                if (updatedUe) {
                    updatedUe.status = 'stable';
                    updatedUe.statusTimestamp = Date.now();
                    window.dataStore.updateNF(updatedUe.id, updatedUe);

                    if (window.logEngine) {
                        window.logEngine.addLog(updatedUe.id, 'SUCCESS', `${updatedUe.name} is now STABLE and ready`, {
                            previousStatus: 'starting',
                            newStatus: 'stable',
                            uptime: '5 seconds'
                        });
                    }

                    if (window.canvasRenderer) {
                        window.canvasRenderer.render();
                    }
                }
            }, 5000);
        }

        if (window.canvasRenderer) {
            window.canvasRenderer.render();
        }
    }

    /**
     * Execute docker compose -f docker-compose-gnb.yml down (stop gNB)
     * @param {HTMLElement} output - Output element
     */
    async dockerComposeGnbDown(output) {
        const allNFs = window.dataStore?.getAllNFs() || [];
        const gnb = allNFs.find(nf => nf.type === 'gNB');

        if (!gnb) {
            this.addTerminalLine(output, 'No gNB container to stop.', 'info');
            return;
        }

        this.addTerminalLine(output, '[+] Running 1/1', 'info');

        const randomDelay = (Math.random() * 0.3 + 0.1).toFixed(1);
        this.addTerminalLine(output, `✔ Container oai-gnb Removed${' '.repeat(20)}${randomDelay}s`, 'success');
        await this.delay(parseFloat(randomDelay) * 1000);

        // Remove gNB
        if (window.nfManager) {
            window.nfManager.deleteNetworkFunction(gnb.id);
        } else if (window.dataStore) {
            window.dataStore.removeNF(gnb.id);
        }

        if (window.canvasRenderer) {
            window.canvasRenderer.render();
        }
    }

    /**
     * Execute docker compose -f docker-compose-ue.yml down (stop all UEs)
     * @param {HTMLElement} output - Output element
     */
    async dockerComposeUeDown(output) {
        const allNFs = window.dataStore?.getAllNFs() || [];
        const ues = allNFs.filter(nf => nf.type === 'UE');

        if (ues.length === 0) {
            this.addTerminalLine(output, 'No UE containers to stop.', 'info');
            return;
        }

        this.addTerminalLine(output, `[+] Running ${ues.length}/${ues.length}`, 'info');

        for (let i = 0; i < ues.length; i++) {
            const ue = ues[i];
            const randomDelay = (Math.random() * 0.2 + 0.1).toFixed(1);
            this.addTerminalLine(output, `✔ Container oai-ue${i + 1} Removed${' '.repeat(20)}${randomDelay}s`, 'success');
            await this.delay(parseFloat(randomDelay) * 1000);

            // Remove UE
            if (window.nfManager) {
                window.nfManager.deleteNetworkFunction(ue.id);
            } else if (window.dataStore) {
                window.dataStore.removeNF(ue.id);
            }
        }

        if (window.canvasRenderer) {
            window.canvasRenderer.render();
        }
    }

    /**
     * Execute docker ps (show running containers)
     * @param {HTMLElement} output - Output element
     */
    async dockerPS(output) {
        const allNFs = window.dataStore?.getAllNFs() || [];

        if (allNFs.length === 0) {
            this.addTerminalLine(output, 'No containers running.', 'info');
            return;
        }

        // Header
        this.addTerminalLine(output, 'CONTAINER ID   IMAGE                                          COMMAND                  CREATED       STATUS                 PORTS                                                   NAMES', 'info');
        this.addTerminalLine(output, '────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────', 'info');

        // Map NF types to Docker service names
        const serviceNameMap = {
            'AMF': 'oai-amf',
            'SMF': 'oai-smf',
            'UPF': 'oai-upf',
            'AUSF': 'oai-ausf',
            'UDM': 'oai-udm',
            'UDR': 'oai-udr',
            'NRF': 'oai-nrf',
            'PCF': 'oai-pcf',
            'NSSF': 'oai-nssf',
            'MySQL': 'mysql',
            'ext-dn': 'ext-dn',
            'gNB': 'oai-gnb',
            'UE': 'oai-ue'
        };

        // Image map
        const imageMap = {
            'AMF': 'ghcr.io/openairinterface/oai-amf:develop',
            'SMF': 'ghcr.io/openairinterface/oai-smf:develop',
            'UPF': 'ghcr.io/openairinterface/oai-upf:develop',
            'AUSF': 'ghcr.io/openairinterface/oai-ausf:develop',
            'UDM': 'ghcr.io/openairinterface/oai-udm:develop',
            'UDR': 'ghcr.io/openairinterface/oai-udr:develop',
            'NRF': 'ghcr.io/openairinterface/oai-nrf:develop',
            'PCF': 'ghcr.io/openairinterface/oai-pcf:develop',
            'NSSF': 'ghcr.io/openairinterface/oai-nssf:develop',
            'MySQL': 'ghcr.io/openairinterface/mysql:8.0',
            'ext-dn': 'ghcr.io/openairinterface/trf-gen-cn5g:latest',
            'gNB': 'ghcr.io/openairinterface/oai-gnb:develop',
            'UE': 'ghcr.io/openairinterface/oai-ue:develop'
        };

        allNFs.forEach((nf, index) => {
            const containerId = this.generateContainerId();
            const serviceName = serviceNameMap[nf.type] || `oai-${nf.type.toLowerCase()}`;
            const image = imageMap[nf.type] || `ghcr.io/openairinterface/oai-${nf.type.toLowerCase()}:develop`;
            const status = nf.status === 'stable' ? 'Up (healthy)' : 'Up (starting)';
            const ports = this.getPortsForNF(nf);

            // Calculate creation time
            const createdAt = nf.createdAt || nf.statusTimestamp || Date.now();
            const createdTime = this.formatCreationTime(createdAt);

            const line = `${containerId}   ${image.padEnd(45)} "${serviceName}"   ${createdTime.padEnd(13)} ${status.padEnd(20)} ${ports.padEnd(55)} ${serviceName}`;
            this.addTerminalLine(output, line, nf.status === 'stable' ? 'success' : 'warning');
        });
    }

    /**
     * Start watch mode for docker compose ps -a
     * @param {HTMLElement} output - Output element
     */
    startWatch(output) {
        if (this.isWatching) {
            this.addTerminalLine(output, 'Watch mode is already running. Use Ctrl+C to stop.', 'warning');
            return;
        }

        this.isWatching = true;
        this.addTerminalLine(output, 'Starting watch mode (refreshes every 1 second)...', 'info');
        this.addTerminalLine(output, 'Press Ctrl+C to stop watching', 'info');
        this.addTerminalLine(output, '', 'blank');

        // Make content focusable and focus it so Ctrl+C keydown fires
        const content = document.getElementById('docker-terminal-content');
        if (content) {
            content.setAttribute('tabindex', '0');
            content.focus();
        }

        // Store initial content length to know where to clear from
        const initialLength = output.querySelectorAll('.docker-terminal-line').length;

        // Initial display
        this.showDockerComposePS(output);

        // Refresh every 1 second
        this.watchInterval = setInterval(() => {
            // Remove all lines added after the initial watch start message
            const allLines = output.querySelectorAll('.docker-terminal-line');
            const linesToRemove = Array.from(allLines).slice(initialLength);
            linesToRemove.forEach(line => line.remove());

            // Add fresh output
            this.showDockerComposePS(output);
        }, 1000);
    }

    /**
     * Stop watch mode
     */
    stopWatch() {
        if (this.watchInterval) {
            clearInterval(this.watchInterval);
            this.watchInterval = null;
            this.isWatching = false;
        }
    }

    /**
     * Show docker compose ps -a output
     * @param {HTMLElement} output - Output element
     */
    showDockerComposePS(output) {
        const allNFs = window.dataStore?.getAllNFs() || [];
        const timestamp = new Date().toLocaleString();

        // Header with timestamp
        this.addTerminalLine(output, `Every 1.0s: docker compose -f docker-compose.yml ps -a`, 'info');
        this.addTerminalLine(output, `Timestamp: ${timestamp}`, 'info');
        this.addTerminalLine(output, '', 'blank');

        if (allNFs.length === 0) {
            this.addTerminalLine(output, 'No services found.', 'info');
            return;
        }

        // Table header
        this.addTerminalLine(output, 'NAME         IMAGE                                     COMMAND                  SERVICE              CREATED              STATUS                        PORTS', 'info');
        this.addTerminalLine(output, '════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════', 'info');

        // Service name map
        const serviceNameMap = {
            'AMF': 'oai-amf',
            'SMF': 'oai-smf',
            'UPF': 'oai-upf',
            'AUSF': 'oai-ausf',
            'UDM': 'oai-udm',
            'UDR': 'oai-udr',
            'NRF': 'oai-nrf',
            'PCF': 'oai-pcf',
            'NSSF': 'oai-nssf',
            'MySQL': 'mysql',
            'ext-dn': 'ext-dn',
            'gNB': 'oai-gnb',
            'UE': 'oai-ue'
        };

        const imageMap = {
            'AMF': 'oaisoftwarealliance/oai-amf:2024-june',
            'SMF': 'oaisoftwarealliance/oai-smf:2024-june',
            'UPF': 'oaisoftwarealliance/oai-upf:2024-june',
            'AUSF': 'oaisoftwarealliance/oai-ausf:2024-june',
            'UDM': 'oaisoftwarealliance/oai-udm:2024-june',
            'UDR': 'oaisoftwarealliance/oai-udr:2024-june',
            'NRF': 'oaisoftwarealliance/oai-nrf:2024-june',
            'PCF': 'oaisoftwarealliance/oai-pcf:2024-june',
            'NSSF': 'oaisoftwarealliance/oai-nssf:2024-june',
            'MySQL': 'mysql:8.0',
            'ext-dn': 'oaisoftwarealliance/trf-gen-cn5g:latest',
            'gNB': 'oaisoftwarealliance/oai-gnb:2024-june',
            'UE': 'oaisoftwarealliance/oai-ue:2024-june'
        };

        allNFs.forEach(nf => {
            const serviceName = serviceNameMap[nf.type] || `oai-${nf.type.toLowerCase()}`;
            const image = imageMap[nf.type] || `oaisoftwarealliance/oai-${nf.type.toLowerCase()}:2024-june`;

            // Calculate creation time
            const createdAt = nf.createdAt || nf.statusTimestamp || Date.now();
            const created = this.formatCreationTimeForWatch(createdAt);
            const status = nf.status === 'stable' ? `Up ${created} (healthy)` : `Up ${created} (starting)`;
            const ports = this.getPortsForNF(nf);

            const statusColor = nf.status === 'stable' ? 'success' : 'warning';
            const statusIcon = nf.status === 'stable' ? '🟢' : '🔴';

            const line = `${serviceName.padEnd(12)} ${image.padEnd(38)} "${serviceName}"   ${serviceName.padEnd(15)} ${created.padEnd(20)} ${status.padEnd(28)} ${ports}`;
            this.addTerminalLine(output, `${statusIcon} ${line}`, statusColor);
        });
    }

    /**
 * Execute docker compose down (stop and remove all core network services)
 * @param {HTMLElement} output - Output element
 */
async dockerComposeDown(output) {
    const allNFs = window.dataStore?.getAllNFs() || [];
    
    // Filter to only core network NFs (exclude gNB and UE)
    const coreNFs = allNFs.filter(nf => nf.type !== 'gNB' && nf.type !== 'UE');

    if (coreNFs.length === 0) {
        this.addTerminalLine(output, 'No core network services to stop.', 'info');
        return;
    }

    // Collect all NF IDs first
    const nfIds = coreNFs.map(nf => ({ id: nf.id, name: nf.name, type: nf.type }));

    // Show Docker Compose style output
    this.addTerminalLine(output, `[+] Running ${nfIds.length + 1}/${nfIds.length + 1}`, 'info');

    // Stop and remove each service
    for (const nfInfo of nfIds) {
        if (nfInfo.type === 'gNB' || nfInfo.type === 'UE') continue;

        const serviceNameMap = {
            'AMF': 'oai-amf', 'SMF': 'oai-smf', 'UPF': 'oai-upf', 'AUSF': 'oai-ausf',
            'UDM': 'oai-udm', 'UDR': 'oai-udr', 'NRF': 'oai-nrf', 'PCF': 'oai-pcf',
            'NSSF': 'oai-nssf', 'MySQL': 'mysql', 'ext-dn': 'oai-ext-dn'
        };
        const serviceName = serviceNameMap[nfInfo.type] || nfInfo.type.toLowerCase();

        const randomDelay = (Math.random() * 1.5 + 0.8).toFixed(1);
        this.addTerminalLine(output, ` ✔ Container ${serviceName.padEnd(16)} Removed${' '.repeat(20)}${randomDelay}s`, 'success');
        await this.delay(parseFloat(randomDelay) * 1000);

        // CRITICAL: Remove NF but preserve buses
        // Pass preserveBuses: true to prevent bus deletion
        if (window.nfManager) {
            window.nfManager.deleteNetworkFunction(nfInfo.id, { preserveBuses: true });
        } else if (window.dataStore) {
            window.dataStore.removeNF(nfInfo.id);
        }
    }

    // DO NOT clear buses and bus connections - removed that block entirely

    // Remove network
    this.addTerminalLine(output, ` ✔ Network oaiworkshop Removed${' '.repeat(20)}0.2s`, 'success');
    this.oaiWorkshopNetworkExists = false;
    this.oaiWorkshopCreatedTime = null;

    this.addTerminalLine(output, '', 'blank');

    if (window.canvasRenderer) {
        window.canvasRenderer.render();
    }
}

    /**
     * Remove a single NF via docker compose down <service>
     * To re-add it the user must run: docker compose -f docker-compose.yml up -d <service>
     * @param {string} serviceName - e.g. "oai-upf"
     * @param {HTMLElement} output
     */
    async dockerComposeSingleDown(serviceName, output) {
        const serviceNameMap = {
            'oai-amf': 'AMF', 'oai-smf': 'SMF', 'oai-upf': 'UPF', 'oai-ausf': 'AUSF',
            'oai-udm': 'UDM', 'oai-udr': 'UDR', 'oai-nrf': 'NRF', 'oai-pcf': 'PCF',
            'oai-nssf': 'NSSF', 'mysql': 'MySQL', 'ext-dn': 'oai-ext-dn', 'oai-ext-dn': 'ext-dn'
        };

        const nfType = serviceNameMap[serviceName.toLowerCase()];
        const allNFs = window.dataStore?.getAllNFs() || [];
        const nf = allNFs.find(n => n.type === nfType);

        if (!nf) {
            this.addTerminalLine(output, `no such service: ${serviceName}`, 'error');
            return;
        }

        this.addTerminalLine(output, `[+] Running 1/1`, 'info');
        const randomDelay = (Math.random() * 0.8 + 0.3).toFixed(1);
        this.addTerminalLine(output, ` ✔ Container ${serviceName.padEnd(16)} Removed${' '.repeat(20)}${randomDelay}s`, 'success');
        await this.delay(parseFloat(randomDelay) * 1000);

        if (window.nfManager) {
            window.nfManager.deleteNetworkFunction(nf.id, { preserveBuses: true });
        } else if (window.dataStore) {
            window.dataStore.removeNF(nf.id);
        }

        this.addTerminalLine(output, '', 'blank');
        this.addTerminalLine(output, `To add it back run:  docker compose -f docker-compose.yml up -d ${serviceName}`, 'info');

        if (window.canvasRenderer) {
            window.canvasRenderer.render();
        }
    }

    /**
     * Re-add a single NF via docker compose up -d <service> and restore its connections
     * @param {string} serviceName - e.g. "oai-upf"
     * @param {HTMLElement} output
     */
    async dockerComposeSingleUp(serviceName, output) {
        const serviceToType = {
            'oai-amf': 'AMF', 'oai-smf': 'SMF', 'oai-upf': 'UPF', 'oai-ausf': 'AUSF',
            'oai-udm': 'UDM', 'oai-udr': 'UDR', 'oai-nrf': 'NRF', 'oai-pcf': 'PCF',
            'oai-nssf': 'NSSF', 'mysql': 'MySQL', 'oai-ext-dn': 'ext-dn'
        };

        const nfType = serviceToType[serviceName.toLowerCase()];
        if (!nfType) {
            this.addTerminalLine(output, `no such service: ${serviceName}`, 'error');
            return;
        }

        // Check if it already exists
        const existing = (window.dataStore?.getAllNFs() || []).find(n => n.type === nfType);
        if (existing) {
            this.addTerminalLine(output, `Container ${serviceName} already running.`, 'warning');
            return;
        }

        if (!window.nfManager) {
            this.addTerminalLine(output, 'Error: NFManager not available.', 'error');
            return;
        }

        // Load topology from one-click.json to get position + original connections
        let topoNFCfg = null;
        let topoBusConnections = [];
        let topoConnections = [];
        let topoBuses = [];
        try {
            const resp = await fetch('../one-click.json');
            if (resp.ok) {
                const topo = await resp.json();
                topoNFCfg = (topo.nfs || []).find(n => n.type === nfType);
                topoBusConnections = topo.busConnections || [];
                topoConnections = topo.connections || [];
                topoBuses = topo.buses || [];
            }
        } catch (_) { /* fall through */ }

        this.addTerminalLine(output, `[+] Running 1/1`, 'info');

        const nf = window.nfManager.createNetworkFunction(nfType, topoNFCfg?.position || null);
        if (!nf) {
            this.addTerminalLine(output, `Failed to create ${serviceName}.`, 'error');
            return;
        }

        nf.status = 'starting';
        nf.statusTimestamp = Date.now();
        nf.createdAt = Date.now();
        window.dataStore.updateNF(nf.id, nf);

        const randomDelay = (Math.random() * 1.2 + 0.5).toFixed(1);
        this.addTerminalLine(output, ` ✔ Container ${serviceName.padEnd(16)} Started${' '.repeat(20)}${randomDelay}s`, 'success');
        await this.delay(parseFloat(randomDelay) * 1000);

        // ── Restore bus connections ──────────────────────────────────────────
        // Find which buses this NF was connected to in one-click.json (by type match)
        if (topoNFCfg && window.busManager) {
            const originalNFId = topoNFCfg.id;

            // Check bus.connections arrays
            for (const topoBus of topoBuses) {
                if (Array.isArray(topoBus.connections) && topoBus.connections.includes(originalNFId)) {
                    // Find the live bus that matches by name or position (buses are preserved)
                    const liveBuses = window.dataStore?.getAllBuses() || [];
                    const liveBus = liveBuses.find(b => b.name === topoBus.name) ||
                                    liveBuses.find(b =>
                                        Math.abs(b.position.x - topoBus.position.x) < 5 &&
                                        Math.abs(b.position.y - topoBus.position.y) < 5
                                    ) ||
                                    liveBuses[0]; // fallback to first bus

                    if (liveBus && !liveBus.connections.includes(nf.id)) {
                        window.busManager.connectNFToBus(nf.id, liveBus.id);
                        this.addTerminalLine(output, `   ↳ Reconnected to ${liveBus.name}`, 'info');
                    }
                }
            }

            // Also check busConnections array for any that reference this NF
            for (const bc of topoBusConnections) {
                if (bc.nfId === originalNFId) {
                    const matchingTopoBus = topoBuses.find(b => b.id === bc.busId);
                    if (!matchingTopoBus) continue;

                    const liveBuses = window.dataStore?.getAllBuses() || [];
                    const liveBus = liveBuses.find(b => b.name === matchingTopoBus.name) ||
                                    liveBuses.find(b =>
                                        Math.abs(b.position.x - matchingTopoBus.position.x) < 5 &&
                                        Math.abs(b.position.y - matchingTopoBus.position.y) < 5
                                    ) ||
                                    liveBuses[0];

                    if (liveBus && !liveBus.connections.includes(nf.id)) {
                        window.busManager.connectNFToBus(nf.id, liveBus.id);
                    }
                }
            }
        }

        // ── Restore NF-to-NF connections ────────────────────────────────────
        // Build a type→liveId map for all currently live NFs
        if (topoNFCfg && window.connectionManager) {
            const originalNFId = topoNFCfg.id;
            const liveNFs = window.dataStore?.getAllNFs() || [];

            // Map original topo IDs → live NF IDs by type
            const topoNFs = [];
            try {
                const resp2 = await fetch('../one-click.json');
                if (resp2.ok) {
                    const t2 = await resp2.json();
                    topoNFs.push(...(t2.nfs || []));
                }
            } catch (_) {}

            const topoIdToLiveId = {};
            for (const tnf of topoNFs) {
                const liveMatch = liveNFs.find(l => l.type === tnf.type);
                if (liveMatch) topoIdToLiveId[tnf.id] = liveMatch.id;
            }
            // The newly created NF maps to itself
            topoIdToLiveId[originalNFId] = nf.id;

            for (const conn of topoConnections) {
                const involvesThis = conn.sourceId === originalNFId || conn.targetId === originalNFId;
                if (!involvesThis) continue;

                const liveSrcId = topoIdToLiveId[conn.sourceId];
                const liveDstId = topoIdToLiveId[conn.targetId];

                if (!liveSrcId || !liveDstId) continue;

                // Skip if connection already exists
                if (window.dataStore.connectionExists(liveSrcId, liveDstId)) continue;

                window.connectionManager.createManualConnection(liveSrcId, liveDstId);
                const srcNF = window.dataStore.getNFById(liveSrcId);
                const dstNF = window.dataStore.getNFById(liveDstId);
                this.addTerminalLine(output, `   ↳ Reconnected ${srcNF?.name || liveSrcId} → ${dstNF?.name || liveDstId}`, 'info');
            }
        }

        if (window.logEngine) {
            window.logEngine.addLog(nf.id, 'INFO', `${nf.name} starting via docker compose`, {
                container: serviceName,
                status: 'starting',
                source: 'docker-compose'
            });
        }

        if (window.canvasRenderer) {
            window.canvasRenderer.render();
        }

        // Transition to stable after 5s
        setTimeout(() => {
            const updatedNF = window.dataStore?.getNFById(nf.id);
            if (updatedNF) {
                updatedNF.status = 'stable';
                updatedNF.statusTimestamp = Date.now();
                window.dataStore.updateNF(updatedNF.id, updatedNF);

                if (window.logEngine) {
                    window.logEngine.addLog(updatedNF.id, 'SUCCESS', `${updatedNF.name} is now STABLE and ready for connections`, {
                        container: serviceName,
                        previousStatus: 'starting',
                        newStatus: 'stable',
                        source: 'docker-compose'
                    });
                }

                if (window.canvasRenderer) {
                    window.canvasRenderer.render();
                }
            }
        }, 5000);
    }

    /**
     * Start a specific service (docker start) — turns dot green, logs the event
     * @param {string} serviceName - Service name to start
     * @param {HTMLElement} output - Output element
     */
    async dockerStart(serviceName, output) {
        if (!serviceName) {
            this.addTerminalLine(output, 'Usage: docker start <service-name>', 'error');
            return;
        }

        const allNFs = window.dataStore?.getAllNFs() || [];
        const serviceNameMap = {
            'oai-amf': 'AMF', 'oai-smf': 'SMF', 'oai-upf': 'UPF', 'oai-ausf': 'AUSF',
            'oai-udm': 'UDM', 'oai-udr': 'UDR', 'oai-nrf': 'NRF', 'oai-pcf': 'PCF',
            'oai-nssf': 'NSSF', 'mysql': 'MySQL', 'ext-dn': 'ext-dn', 'oai-gnb': 'gNB', 'oai-ue': 'UE'
        };

        const nfType = serviceNameMap[serviceName.toLowerCase()];
        const nf = allNFs.find(n => n.type === nfType);

        if (!nf) {
            this.addTerminalLine(output, `Error response from daemon: No such container: ${serviceName}`, 'error');
            return;
        }

        this.addTerminalLine(output, serviceName, 'info');

        if (!nf.createdAt) {
            nf.createdAt = Date.now();
        }
        nf.status = 'starting';
        nf.statusTimestamp = Date.now();
        window.dataStore.updateNF(nf.id, nf);

        if (window.logEngine) {
            window.logEngine.addLog(nf.id, 'INFO', `${nf.name} is starting`, {
                container: serviceName,
                previousStatus: 'stopped',
                newStatus: 'starting',
                startedAt: new Date().toISOString(),
                source: 'docker start'
            });
        }

        if (window.canvasRenderer) {
            window.canvasRenderer.render();
        }

        // Transition to stable after 5s — dot turns green
        setTimeout(() => {
            const updatedNF = window.dataStore?.getNFById(nf.id);
            if (updatedNF) {
                updatedNF.status = 'stable';
                updatedNF.statusTimestamp = Date.now();
                window.dataStore.updateNF(updatedNF.id, updatedNF);

                if (window.logEngine) {
                    window.logEngine.addLog(updatedNF.id, 'SUCCESS', `${updatedNF.name} is now STABLE and running`, {
                        container: serviceName,
                        previousStatus: 'starting',
                        newStatus: 'stable',
                        source: 'docker start'
                    });
                }

                if (window.canvasRenderer) {
                    window.canvasRenderer.render();
                }
            }
        }, 5000);
    }

    /**
     * Stop a specific service (docker stop) — turns dot red, logs the event
     * @param {string} serviceName - Service name to stop
     * @param {HTMLElement} output - Output element
     */
    async dockerStop(serviceName, output) {
        if (!serviceName) {
            this.addTerminalLine(output, 'Usage: docker stop <service-name>', 'error');
            return;
        }

        const allNFs = window.dataStore?.getAllNFs() || [];
        const serviceNameMap = {
            'oai-amf': 'AMF', 'oai-smf': 'SMF', 'oai-upf': 'UPF', 'oai-ausf': 'AUSF',
            'oai-udm': 'UDM', 'oai-udr': 'UDR', 'oai-nrf': 'NRF', 'oai-pcf': 'PCF',
            'oai-nssf': 'NSSF', 'mysql': 'MySQL', 'ext-dn': 'ext-dn', 'oai-gnb': 'gNB', 'oai-ue': 'UE'
        };

        const nfType = serviceNameMap[serviceName.toLowerCase()];
        const nf = allNFs.find(n => n.type === nfType);

        if (!nf) {
            this.addTerminalLine(output, `Error response from daemon: No such container: ${serviceName}`, 'error');
            return;
        }

        this.addTerminalLine(output, serviceName, 'info');

        // Set status to stopped — canvas-renderer maps this to red via getStatusColor
        nf.status = 'stopped';
        nf.statusTimestamp = Date.now();
        window.dataStore.updateNF(nf.id, nf);

        // Log the stop event
        if (window.logEngine) {
            window.logEngine.addLog(nf.id, 'WARNING', `${nf.name} has been stopped`, {
                container: serviceName,
                previousStatus: 'stable',
                newStatus: 'stopped',
                stoppedAt: new Date().toISOString(),
                source: 'docker stop'
            });
        }

        if (window.canvasRenderer) {
            window.canvasRenderer.render();
        }
    }

    /**
     * ls command - list files in current directory
     * @param {HTMLElement} output - Output element
     */
    lsCommand(output) {
        const files = [
            { name: 'docker-compose.yml',     type: 'file',  size: '4.2K', date: 'Apr 10 09:15' },
        ];
        files.forEach(f => {
            const color = f.type === 'dir' ? 'docker-terminal-success' : 'docker-terminal-info';
            const prefix = f.type === 'dir' ? 'd' : '-';
            const perms = f.type === 'dir' ? 'rwxr-xr-x' : 'rw-r--r--';
            const line = `${f.name}`;
            const el = document.createElement('div');
            el.className = `docker-terminal-line ${color}`;
            el.textContent = line;
            output.appendChild(el);
        });
        output.scrollTop = output.scrollHeight;
    }

    /**
     * vi docker-compose.yml - read-only viewer
     * @param {HTMLElement} output - Output element
     * @param {HTMLElement} content - Content container
     * @param {Function} createInputLine - Function to restore normal input
     */
    viDockerCompose(output, content, createInputLine) {
        const dockerComposeContent = `services:
  mysql:
    container_name: "mysql"
    image: ghcr.io/openairinterface/mysql:8.0
    volumes:
      - ./database/oai_db.sql:/docker-entrypoint-initdb.d/oai_db.sql
      - ./healthscripts/mysql-healthcheck.sh:/tmp/mysql-healthcheck.sh
    environment:
      - TZ=Europe/Paris
      - MYSQL_DATABASE=oai_db
      - MYSQL_USER=test
      - MYSQL_PASSWORD=test
      - MYSQL_ROOT_PASSWORD=linux
    healthcheck:
      test: /bin/bash -c "/tmp/mysql-healthcheck.sh"
      interval: 10s
      timeout: 5s
      retries: 30
    networks:
      public_net:
        ipv4_address: 192.168.70.131

  oai-udr:
    container_name: "oai-udr"
    image: ghcr.io/openairinterface/oai-udr:develop
    expose:
      - 80/tcp
      - 8080/tcp
    volumes:
      - ./conf/config.yaml:/openair-udr/etc/config.yaml
    environment:
      - TZ=Europe/Paris
    depends_on:
      - mysql
      - oai-nrf
    networks:
      public_net:
        ipv4_address: 192.168.70.136

  oai-udm:
    container_name: "oai-udm"
    image: ghcr.io/openairinterface/oai-udm:develop
    expose:
      - 80/tcp
      - 8080/tcp
    volumes:
      - ./conf/config.yaml:/openair-udm/etc/config.yaml
    environment:
      - TZ=Europe/Paris
    depends_on:
      - oai-udr
    networks:
      public_net:
        ipv4_address: 192.168.70.137

  oai-ausf:
    container_name: "oai-ausf"
    image: ghcr.io/openairinterface/oai-ausf:develop
    expose:
      - 80/tcp
      - 8080/tcp
    volumes:
      - ./conf/config.yaml:/openair-ausf/etc/config.yaml
    environment:
      - TZ=Europe/Paris
    depends_on:
      - oai-udm
    networks:
      public_net:
        ipv4_address: 192.168.70.138

  oai-nrf:
    container_name: "oai-nrf"
    image: ghcr.io/openairinterface/oai-nrf:develop
    expose:
      - 80/tcp
      - 8080/tcp
    volumes:
      - ./conf/config.yaml:/openair-nrf/etc/config.yaml
    environment:
      - TZ=Europe/Paris
    networks:
      public_net:
        ipv4_address: 192.168.70.130

  oai-amf:
    container_name: "oai-amf"
    image: ghcr.io/openairinterface/oai-amf:develop
    expose:
      - 80/tcp
      - 8080/tcp
      - 38412/sctp
    volumes:
      - ./conf/config.yaml:/openair-amf/etc/config.yaml
    environment:
      - TZ=Europe/Paris
    depends_on:
      - mysql
      - oai-nrf
      - oai-ausf
    networks:
      public_net:
        ipv4_address: 192.168.70.132

  oai-smf:
    container_name: "oai-smf"
    image: ghcr.io/openairinterface/oai-smf:develop
    expose:
      - 80/tcp
      - 8080/tcp
      - 8805/udp
    volumes:
      - ./conf/config.yaml:/openair-smf/etc/config.yaml
    environment:
      - TZ=Europe/Paris
    depends_on:
      - oai-nrf
      - oai-amf
    networks:
      public_net:
        ipv4_address: 192.168.70.133

  oai-upf:
    container_name: "oai-upf"
    image: ghcr.io/openairinterface/oai-upf:develop
    expose:
      - 80/tcp
      - 2152/udp
      - 8805/udp
    volumes:
      - ./conf/config.yaml:/openair-upf/etc/config.yaml
    environment:
      - TZ=Europe/Paris
    depends_on:
      - oai-nrf
      - oai-smf
    cap_add:
      - NET_ADMIN
      - SYS_ADMIN
    cap_drop:
      - ALL
    privileged: true
    networks:
      public_net:
        ipv4_address: 192.168.70.134

  oai-traffic-server:
    privileged: true
    init: true
    container_name: oai-ext-dn
    image: ghcr.io/openairinterface/trf-gen-cn5g:latest
    environment:
      - UPF_FQDN=oai-upf
      - UE_NETWORK=10.0.0.0/24
      - USE_FQDN=yes
    healthcheck:
      test: /bin/bash -c "ip r | grep 12.1.1"
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      public_net:
        ipv4_address: 192.168.70.135

networks:
  public_net:
    driver: bridge
    name: oaiworkshop
    ipam:
      config:
        - subnet: 192.168.70.128/26
    driver_opts:
      com.docker.network.bridge.name: "oaiworkshop"`;

        // Build a full-screen vi overlay inside the terminal window
        const termWindow = document.getElementById('docker-terminal-window');
        if (!termWindow) return;

        // Hide the normal content area
        const termContent = document.getElementById('docker-terminal-content');
        if (termContent) termContent.style.display = 'none';

        // Create vi overlay
        const viOverlay = document.createElement('div');
        viOverlay.id = 'vi-overlay';
        viOverlay.style.cssText = [
            'position:absolute',
            'top:32px',          // below titlebar
            'left:0',
            'right:0',
            'bottom:0',
            'background:#000000',
            'display:flex',
            'flex-direction:column',
            'font-family:Consolas,"Courier New",monospace',
            'font-size:14px',
            'z-index:10',
        ].join(';');

        // Scrollable file content area
        const fileArea = document.createElement('div');
        fileArea.style.cssText = 'flex:1;overflow-y:auto;padding:0 4px;';

        const lines = dockerComposeContent.split('\n');
        lines.forEach((line, i) => {
            const el = document.createElement('div');
            el.style.cssText = 'white-space:pre;color:#ffffff;line-height:1.5;';
            const lineNum = String(i + 1).padStart(4, ' ');
            el.textContent = lineNum + '  ' + line;
            fileArea.appendChild(el);
        });

        // Fixed status bar (bottom-1)
        const statusBar = document.createElement('div');
        statusBar.style.cssText = [
            'background:#1a1a6e',
            'color:#ffffff',
            'padding:1px 8px',
            'font-weight:bold',
            'flex-shrink:0',
            'white-space:nowrap',
            'overflow:hidden',
        ].join(';');
        statusBar.textContent = '"docker-compose.yml" [readonly]  ' + lines.length + 'L';

        // Command line at very bottom — shows typed :q
        const cmdBar = document.createElement('div');
        cmdBar.style.cssText = [
            'display:flex',
            'align-items:center',
            'background:#000000',
            'color:#ffffff',
            'padding:1px 4px',
            'flex-shrink:0',
            'min-height:22px',
        ].join(';');

        const cmdLabel = document.createElement('span');
        cmdLabel.style.cssText = 'color:#ffffff;min-width:8px;';
        cmdLabel.textContent = '';

        const cmdInput = document.createElement('input');
        cmdInput.type = 'text';
        cmdInput.autocomplete = 'off';
        cmdInput.spellcheck = false;
        cmdInput.style.cssText = [
            'flex:1',
            'background:transparent',
            'border:none',
            'outline:none',
            'color:#ffffff',
            'font-family:Consolas,"Courier New",monospace',
            'font-size:14px',
            'caret-color:#ffffff',
            'padding:0',
        ].join(';');

        cmdBar.appendChild(cmdLabel);
        cmdBar.appendChild(cmdInput);

        viOverlay.appendChild(fileArea);
        viOverlay.appendChild(statusBar);
        viOverlay.appendChild(cmdBar);
        termWindow.appendChild(viOverlay);

        // Focus and scroll to top
        fileArea.scrollTop = 0;
        cmdInput.focus();

        // Key handler — real vi behaviour
        cmdInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                // ESC clears the command line (like real vi)
                cmdLabel.textContent = '';
                cmdInput.value = '';
                e.preventDefault();
                return;
            }

            if (e.key === ':' && cmdInput.value === '') {
                // Show the colon prompt
                cmdLabel.textContent = ':';
                e.preventDefault();
                return;
            }

            if (e.key === 'Enter') {
                const cmd = cmdInput.value.trim();
                if (cmd === 'q' || cmd === 'q!' || cmd === 'wq' || cmd === 'quit') {
                    // Exit vi — remove overlay, restore terminal
                    viOverlay.remove();
                    if (termContent) termContent.style.display = 'flex';
                    this.addTerminalLine(output, '', 'blank');
                    createInputLine();
                } else if (cmd !== '') {
                    // Unknown command — show error in status bar like real vi
                    statusBar.textContent = 'E492: Not an editor command: ' + cmdLabel.textContent + cmd;
                    statusBar.style.background = '#8b0000';
                    cmdLabel.textContent = '';
                    cmdInput.value = '';
                    setTimeout(() => {
                        statusBar.textContent = '"docker-compose.yml" [readonly]  ' + lines.length + 'L';
                        statusBar.style.background = '#1a1a6e';
                    }, 2000);
                }
                e.preventDefault();
                return;
            }

            // G key — jump to end (like real vi)
            if (e.key === 'G' && cmdInput.value === '' && cmdLabel.textContent === '') {
                fileArea.scrollTop = fileArea.scrollHeight;
                e.preventDefault();
                return;
            }

            // gg — jump to top
            if (e.key === 'g' && cmdInput.value === '' && cmdLabel.textContent === '') {
                fileArea.scrollTop = 0;
                e.preventDefault();
                return;
            }

            // Arrow keys / Page scroll when not in command mode
            if (cmdLabel.textContent === '' && cmdInput.value === '') {
                if (e.key === 'ArrowDown' || e.key === 'j') {
                    fileArea.scrollTop += 21;
                    e.preventDefault();
                } else if (e.key === 'ArrowUp' || e.key === 'k') {
                    fileArea.scrollTop -= 21;
                    e.preventDefault();
                } else if (e.key === 'PageDown' || e.key === 'f') {
                    fileArea.scrollTop += fileArea.clientHeight;
                    e.preventDefault();
                } else if (e.key === 'PageUp' || e.key === 'b') {
                    fileArea.scrollTop -= fileArea.clientHeight;
                    e.preventDefault();
                }
            }
        });

        // Show ":q to quit" hint in status bar initially
        statusBar.textContent = '"docker-compose.yml" [readonly]  ' + lines.length + 'L  --  Type  :q  and Enter to quit';
    }

        /**
     * Add line to terminal output
     * @param {HTMLElement} output - Output element
     * @param {string} text - Text to add
     * @param {string} type - Line type
     */
    addTerminalLine(output, text, type = 'normal') {
        const line = document.createElement('div');
        line.className = `docker-terminal-line docker-terminal-${type}`;
        line.innerHTML = text || '&nbsp;';
        output.appendChild(line);
        output.scrollTop = output.scrollHeight;
    }

    /**
     * Generate container ID
     * @returns {string} Random container ID
     */
    generateContainerId() {
        const chars = '0123456789abcdef';
        let id = '';
        for (let i = 0; i < 12; i++) {
            id += chars[Math.floor(Math.random() * chars.length)];
        }
        return id;
    }

    /**
     * Get ports for NF
     * @param {Object} nf - Network Function
     * @returns {string} Ports string
     */
    getPortsForNF(nf) {
        const portMap = {
            'AMF': '80/tcp, 8080/tcp, 9090/tcp, 38412/sctp',
            'SMF': '80/tcp, 8080/tcp, 8805/udp',
            'UPF': '2152/udp, 8805/udp',
            'AUSF': '80/tcp, 8080/tcp',
            'UDM': '80/tcp, 8080/tcp',
            'UDR': '80/tcp, 8080/tcp',
            'NRF': '80/tcp, 8080/tcp, 9090/tcp',
            'PCF': '80/tcp, 8080/tcp',
            'NSSF': '80/tcp, 8080/tcp',
            'MySQL': '3306/tcp, 33060/tcp',
            'gNB': '2152/udp, 38412/sctp',
            'UE': '2152/udp'
        };
        return portMap[nf.type] || `${nf.config.port}/tcp`;
    }

    /**
     * Create default NFs as fallback
     * @param {HTMLElement} output - Output element
     */
    async createDefaultNFs(output) {
        const defaultNFs = this.getDefaultNFConfigurations();
        const creationTime = Date.now();

        for (const nfConfig of defaultNFs) {
            this.addTerminalLine(output, `Creating ${nfConfig.type}...`, 'info');

            const position = window.nfManager.calculateAutoPosition(nfConfig.type, 1);
            const nf = window.nfManager.createNetworkFunction(nfConfig.type, position);

            if (nf) {
                nf.config.ipAddress = nfConfig.ipAddress;
                nf.config.port = nfConfig.port;
                nf.config.httpProtocol = nfConfig.httpProtocol || 'HTTP/2';
                nf.createdAt = creationTime;
                window.dataStore.updateNF(nf.id, nf);
                this.addTerminalLine(output, `✅ ${nf.name} created (${nfConfig.ipAddress}:${nfConfig.port})`, 'success');
                await this.delay(200);
            }
        }

        this.addTerminalLine(output, '', 'blank');
        this.addTerminalLine(output, `✅ Created ${defaultNFs.length} default Network Functions`, 'success');
    }

    /**
     * Filter topology to exclude gNB and UE
     * @param {Object} topology - Topology object
     * @returns {Object} Filtered topology
     */
    filterTopology(topology) {
        const filtered = JSON.parse(JSON.stringify(topology));

        if (filtered.nfs && Array.isArray(filtered.nfs)) {
            filtered.nfs = filtered.nfs.filter(nf => nf.type !== 'gNB' && nf.type !== 'UE');
        }

        const serviceBusNFIds = new Set();
        if (filtered.buses && Array.isArray(filtered.buses)) {
            filtered.buses.forEach(bus => {
                if (bus.connections && Array.isArray(bus.connections)) {
                    bus.connections.forEach(nfId => {
                        serviceBusNFIds.add(nfId);
                    });
                }
            });
        }

        if (filtered.busConnections && Array.isArray(filtered.busConnections)) {
            filtered.busConnections.forEach(busConn => {
                serviceBusNFIds.add(busConn.nfId);
            });
        }

        if (filtered.connections && Array.isArray(filtered.connections)) {
            const excludedNFIds = new Set();
            if (topology.nfs) {
                topology.nfs.forEach(nf => {
                    if (nf.type === 'gNB' || nf.type === 'UE') {
                        excludedNFIds.add(nf.id);
                    }
                });
            }

            filtered.connections = filtered.connections.filter(conn => {
                if (excludedNFIds.has(conn.sourceId) || excludedNFIds.has(conn.targetId)) {
                    return false;
                }

                const bothOnServiceBus = serviceBusNFIds.has(conn.sourceId) && serviceBusNFIds.has(conn.targetId);
                if (bothOnServiceBus) {
                    const serviceBusInterfaces = ['Nnrf_NFManagement', 'Nnrf_NFDiscovery', 'Nnrf',
                        'Namf', 'Nsmf', 'Nausf', 'Nudm', 'Npcf', 'Nnssf', 'Nudr'];
                    const isServiceBusInterface = serviceBusInterfaces.some(iface =>
                        conn.interfaceName?.includes(iface) || conn.interfaceName === iface);
                    if (isServiceBusInterface) {
                        return false;
                    }
                }
                return true;
            });
        }

        if (filtered.busConnections && Array.isArray(filtered.busConnections)) {
            const excludedNFIds = new Set();
            if (topology.nfs) {
                topology.nfs.forEach(nf => {
                    if (nf.type === 'gNB' || nf.type === 'UE') {
                        excludedNFIds.add(nf.id);
                    }
                });
            }
            filtered.busConnections = filtered.busConnections.filter(busConn => !excludedNFIds.has(busConn.nfId));
        }

        if (filtered.buses && Array.isArray(filtered.buses)) {
            filtered.buses.forEach(bus => {
                if (bus.connections && Array.isArray(bus.connections)) {
                    const excludedNFIds = new Set();
                    if (topology.nfs) {
                        topology.nfs.forEach(nf => {
                            if (nf.type === 'gNB' || nf.type === 'UE') {
                                excludedNFIds.add(nf.id);
                            }
                        });
                    }
                    bus.connections = bus.connections.filter(nfId => !excludedNFIds.has(nfId));
                }
            });
        }

        return filtered;
    }

    /**
     * Get default NF configurations
     * @returns {Array} Array of default NF configurations
     */
    getDefaultNFConfigurations() {
        return [
            { type: 'NRF', ipAddress: '192.168.1.10', port: 8080, httpProtocol: 'HTTP/2' },
            { type: 'AMF', ipAddress: '192.168.1.20', port: 8080, httpProtocol: 'HTTP/2' },
            { type: 'SMF', ipAddress: '192.168.1.30', port: 8080, httpProtocol: 'HTTP/2' },
            { type: 'UPF', ipAddress: '192.168.1.40', port: 8080, httpProtocol: 'HTTP/2' },
            { type: 'AUSF', ipAddress: '192.168.1.50', port: 8080, httpProtocol: 'HTTP/2' },
            { type: 'UDM', ipAddress: '192.168.1.60', port: 8080, httpProtocol: 'HTTP/2' },
            { type: 'UDR', ipAddress: '192.168.1.70', port: 8080, httpProtocol: 'HTTP/2' },
            { type: 'PCF', ipAddress: '192.168.1.80', port: 8080, httpProtocol: 'HTTP/2' },
            { type: 'NSSF', ipAddress: '192.168.1.90', port: 8080, httpProtocol: 'HTTP/2' },
            { type: 'MySQL', ipAddress: '192.168.1.100', port: 3306, httpProtocol: 'HTTP/2' }
        ];
    }

    /**
     * Format creation time for docker ps
     * @param {number} timestamp - Creation timestamp
     * @returns {string} Formatted time string
     */
    formatCreationTime(timestamp) {
        if (!timestamp) return '3 weeks ago';
        const now = Date.now();
        const diff = now - timestamp;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (seconds < 60) {
            return `${seconds} second${seconds !== 1 ? 's' : ''} ago`;
        } else if (minutes < 60) {
            return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
        } else if (hours < 24) {
            return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
        } else if (days < 7) {
            return `${days} day${days !== 1 ? 's' : ''} ago`;
        } else if (days < 30) {
            const weeks = Math.floor(days / 7);
            return `${weeks} week${weeks !== 1 ? 's' : ''} ago`;
        } else {
            const months = Math.floor(days / 30);
            return `${months} month${months !== 1 ? 's' : ''} ago`;
        }
    }

    /**
     * Format creation time for watch command
     * @param {number} timestamp - Creation timestamp
     * @returns {string} Formatted time string
     */
    formatCreationTimeForWatch(timestamp) {
        if (!timestamp) return 'About a minute ago';
        const now = Date.now();
        const diff = now - timestamp;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);

        if (seconds < 30) {
            return 'Just now';
        } else if (seconds < 60) {
            return 'About a minute ago';
        } else if (minutes === 1) {
            return 'About a minute ago';
        } else if (minutes < 60) {
            return `About ${minutes} minutes ago`;
        } else {
            const hours = Math.floor(minutes / 60);
            if (hours === 1) {
                return 'About an hour ago';
            } else if (hours < 24) {
                return `About ${hours} hours ago`;
            } else {
                const days = Math.floor(hours / 24);
                if (days === 1) {
                    return 'About a day ago';
                } else {
                    return `About ${days} days ago`;
                }
            }
        }
    }

    /**
     * Delay helper
     * @param {number} ms - Milliseconds to delay
     * @returns {Promise} Promise that resolves after delay
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Setup window controls (resize only, no drag)
     * @param {HTMLElement} terminalModal - Terminal modal element
     */
    setupWindowControls(terminalModal) {
        const terminalWindow = document.getElementById('docker-terminal-window');
        const resizeHandle = document.getElementById('docker-terminal-resize-handle');

        if (!terminalWindow) return;

        // Resize from bottom-right handle
        let isResizing = false;
        let resizeStartX = 0;
        let resizeStartY = 0;
        let startWidth = 0;
        let startHeight = 0;

        if (resizeHandle) {
            resizeHandle.addEventListener('mousedown', (e) => {
                isResizing = true;
                resizeStartX = e.clientX;
                resizeStartY = e.clientY;
                startWidth = terminalWindow.offsetWidth;
                startHeight = terminalWindow.offsetHeight;
                e.preventDefault();
                e.stopPropagation();
            });
        }

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            const newWidth = Math.max(400, Math.min(startWidth + (e.clientX - resizeStartX), window.innerWidth - 40));
            const newHeight = Math.max(300, Math.min(startHeight + (e.clientY - resizeStartY), window.innerHeight - 40));
            this.terminalState.width = newWidth;
            this.terminalState.height = newHeight;
            terminalWindow.style.width = newWidth + 'px';
            terminalWindow.style.height = newHeight + 'px';
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                this.saveTerminalState();
            }
        });
    }

    /**
     * Minimize terminal window
     * @param {HTMLElement} terminalWindow - Terminal window element
     */
    minimizeTerminal(terminalWindow) {
        this.terminalState.isMinimized = !this.terminalState.isMinimized;

        if (this.terminalState.isMinimized) {
            terminalWindow.style.height = '35px';
            const content = document.getElementById('docker-terminal-content');
            if (content) content.style.display = 'none';
            const resizeHandle = document.getElementById('docker-terminal-resize-handle');
            if (resizeHandle) resizeHandle.style.display = 'none';
        } else {
            terminalWindow.style.height = this.terminalState.height + 'px';
            const content = document.getElementById('docker-terminal-content');
            if (content) content.style.display = 'flex';
            const resizeHandle = document.getElementById('docker-terminal-resize-handle');
            if (resizeHandle) resizeHandle.style.display = 'block';
        }

        this.saveTerminalState();
    }

    /**
     * Toggle maximize/restore terminal window
     * @param {HTMLElement} terminalWindow - Terminal window element
     */
    toggleMaximize(terminalWindow) {
        this.terminalState.isMaximized = !this.terminalState.isMaximized;
        const maximizeBtn = document.getElementById('docker-terminal-maximize');

        if (this.terminalState.isMaximized) {
            if (!terminalWindow.style.left) {
                const rect = terminalWindow.getBoundingClientRect();
                this.terminalState.x = rect.left;
                this.terminalState.y = rect.top;
            }

            terminalWindow.style.left = '0';
            terminalWindow.style.top = '0';
            terminalWindow.style.width = '100vw';
            terminalWindow.style.height = '100vh';
            terminalWindow.style.transform = 'none';
            terminalWindow.style.borderRadius = '0';
            if (maximizeBtn) maximizeBtn.textContent = '❐';
        } else {
            terminalWindow.style.width = this.terminalState.width + 'px';
            terminalWindow.style.height = this.terminalState.height + 'px';
            terminalWindow.style.borderRadius = '8px 8px 0 0';

            if (this.terminalState.x !== null && this.terminalState.y !== null) {
                terminalWindow.style.left = this.terminalState.x + 'px';
                terminalWindow.style.top = this.terminalState.y + 'px';
                terminalWindow.style.transform = 'none';
            } else {
                terminalWindow.style.left = '';
                terminalWindow.style.top = '';
                terminalWindow.style.transform = '';
            }

            if (maximizeBtn) maximizeBtn.textContent = '□';
        }

        this.saveTerminalState();
    }

    /**
     * Apply saved terminal state
     */
    applyTerminalState() {
        const terminalWindow = document.getElementById('docker-terminal-window');
        if (!terminalWindow) return;

        const savedState = localStorage.getItem('dockerTerminalState');
        if (savedState) {
            try {
                const state = JSON.parse(savedState);
                this.terminalState = { ...this.terminalState, ...state };
            } catch (e) {
                console.warn('Failed to load terminal state:', e);
            }
        }

        terminalWindow.style.width = this.terminalState.width + 'px';
        terminalWindow.style.height = this.terminalState.height + 'px';

        if (this.terminalState.x !== null && this.terminalState.y !== null) {
            terminalWindow.style.left = this.terminalState.x + 'px';
            terminalWindow.style.top = this.terminalState.y + 'px';
            terminalWindow.style.transform = 'none';
        }

        if (this.terminalState.isMaximized) {
            this.toggleMaximize(terminalWindow);
        }

        if (this.terminalState.isMinimized) {
            this.minimizeTerminal(terminalWindow);
        }
    }

    /**
     * Save terminal state to localStorage
     */
    saveTerminalState() {
        try {
            localStorage.setItem('dockerTerminalState', JSON.stringify(this.terminalState));
        } catch (e) {
            console.warn('Failed to save terminal state:', e);
        }
    }

    /**
     * Docker network ls command
     * @param {HTMLElement} output - Output element
     */
    dockerNetworkLS(output) {
        this.addTerminalLine(output, 'NETWORK ID     NAME          DRIVER    SCOPE', 'info');
        this.addTerminalLine(output, 'df33e4a6502d   bridge        bridge    local', 'info');
        this.addTerminalLine(output, '902c1fcc4369   host          host      local', 'info');
        this.addTerminalLine(output, '0c712814bbb0   none          null      local', 'info');

        if (this.oaiWorkshopNetworkExists) {
            this.addTerminalLine(output, `${this.oaiWorkshopNetworkId}   oaiworkshop   bridge    local`, 'success');
        }
    }

    /**
     * Docker network inspect command
     * @param {string} networkName - Network name to inspect
     * @param {HTMLElement} output - Output element
     */
    dockerNetworkInspect(networkName, output) {
        if (networkName === 'bridge') {
            this.inspectBridgeNetwork(output);
        } else if (networkName === 'host') {
            this.inspectHostNetwork(output);
        } else if (networkName === 'none') {
            this.inspectNoneNetwork(output);
        } else if (networkName === 'oaiworkshop') {
            if (this.oaiWorkshopNetworkExists) {
                this.inspectOAIWorkshopNetwork(output);
            } else {
                this.addTerminalLine(output, `Error: No such network: ${networkName}`, 'error');
            }
        } else {
            this.addTerminalLine(output, `Error: No such network: ${networkName}`, 'error');
        }
    }

    /**
     * Inspect bridge network
     * @param {HTMLElement} output - Output element
     */
    inspectBridgeNetwork(output) {
        const json = {
            "Name": "bridge",
            "Id": "df33e4a6502d1229e87fbd225ce8cc4b95fd4553fcaadee50fd5a70a4a021f3d",
            "Created": "2026-01-30T15:26:16.417604705+05:30",
            "Scope": "local",
            "Driver": "bridge",
            "EnableIPv4": true,
            "EnableIPv6": false,
            "IPAM": {
                "Driver": "default",
                "Options": null,
                "Config": [{ "Subnet": "172.17.0.0/16", "Gateway": "172.17.0.1" }]
            },
            "Internal": false,
            "Attachable": false,
            "Ingress": false,
            "ConfigFrom": { "Network": "" },
            "ConfigOnly": false,
            "Containers": {},
            "Options": {
                "com.docker.network.bridge.default_bridge": "true",
                "com.docker.network.bridge.enable_icc": "true",
                "com.docker.network.bridge.enable_ip_masquerade": "true",
                "com.docker.network.bridge.host_binding_ipv4": "0.0.0.0",
                "com.docker.network.bridge.name": "docker0",
                "com.docker.network.driver.mtu": "1500"
            },
            "Labels": {}
        };
        this.addTerminalLine(output, JSON.stringify([json], null, 2), 'info');
    }

    /**
     * Inspect host network
     * @param {HTMLElement} output - Output element
     */
    inspectHostNetwork(output) {
        const json = {
            "Name": "host",
            "Id": "902c1fcc436950abba5007bd8b39b65ab96fd9c72b3873519ebc55bc14315b74",
            "Created": "2026-01-20T15:04:16.397276602+05:30",
            "Scope": "local",
            "Driver": "host",
            "EnableIPv4": true,
            "EnableIPv6": false,
            "IPAM": { "Driver": "default", "Options": null, "Config": null },
            "Internal": false,
            "Attachable": false,
            "Ingress": false,
            "ConfigFrom": { "Network": "" },
            "ConfigOnly": false,
            "Containers": {},
            "Options": {},
            "Labels": {}
        };
        this.addTerminalLine(output, JSON.stringify([json], null, 2), 'info');
    }

    /**
     * Inspect none network
     * @param {HTMLElement} output - Output element
     */
    inspectNoneNetwork(output) {
        const json = {
            "Name": "none",
            "Id": "0c712814bbb0c32a4d2846f885d90534121f472d0c71d0c34330ad6da8327020",
            "Created": "2026-01-20T15:04:16.389588497+05:30",
            "Scope": "local",
            "Driver": "null",
            "EnableIPv4": true,
            "EnableIPv6": false,
            "IPAM": { "Driver": "default", "Options": null, "Config": null },
            "Internal": false,
            "Attachable": false,
            "Ingress": false,
            "ConfigFrom": { "Network": "" },
            "ConfigOnly": false,
            "Containers": {},
            "Options": {},
            "Labels": {}
        };
        this.addTerminalLine(output, JSON.stringify([json], null, 2), 'info');
    }

    /**
     * Inspect OAI workshop network
     * @param {HTMLElement} output - Output element
     */
    inspectOAIWorkshopNetwork(output) {
        const allNFs = window.dataStore?.getAllNFs() || [];
        const containers = {};

        allNFs.forEach(nf => {
            const serviceNameMap = {
                'AMF': 'oai-amf', 'SMF': 'oai-smf', 'UPF': 'oai-upf', 'AUSF': 'oai-ausf',
                'UDM': 'oai-udm', 'UDR': 'oai-udr', 'NRF': 'oai-nrf', 'PCF': 'oai-pcf',
                'NSSF': 'oai-nssf', 'MySQL': 'mysql', 'ext-dn': 'oai-ext-dn'
            };
            const serviceName = serviceNameMap[nf.type] || nf.type.toLowerCase();
            const containerId = this.generateContainerId() + this.generateContainerId() + this.generateContainerId() + this.generateContainerId() + this.generateContainerId() + 'abcd';

            containers[containerId] = {
                "Name": serviceName,
                "EndpointID": this.generateContainerId() + this.generateContainerId() + this.generateContainerId() + this.generateContainerId() + this.generateContainerId() + 'ef01',
                "MacAddress": this.generateMacAddress(),
                "IPv4Address": nf.config.ipAddress + "/26",
                "IPv6Address": ""
            };
        });

        const createdTime = this.oaiWorkshopCreatedTime ? new Date(this.oaiWorkshopCreatedTime).toISOString() : new Date().toISOString();

        const json = {
            "Name": "oaiworkshop",
            "Id": this.oaiWorkshopNetworkId + "d0a87f40b563d8172b3f54045b0da9d9b859ed25522c2aaa8b86",
            "Created": createdTime,
            "Scope": "local",
            "Driver": "bridge",
            "EnableIPv4": true,
            "EnableIPv6": false,
            "IPAM": {
                "Driver": "default",
                "Options": null,
                "Config": [{ "Subnet": "192.168.70.128/26" }]
            },
            "Internal": false,
            "Attachable": false,
            "Ingress": false,
            "ConfigFrom": { "Network": "" },
            "ConfigOnly": false,
            "Containers": containers,
            "Options": { "com.docker.network.bridge.name": "oaiworkshop" },
            "Labels": {
                "com.docker.compose.config-hash": "dca0e19cf413805e199db52df7a818f82ffd4a571265d5f722c8e2198676da59",
                "com.docker.compose.network": "public_net",
                "com.docker.compose.project": "cn",
                "com.docker.compose.version": "5.0.1"
            }
        };

        this.addTerminalLine(output, JSON.stringify([json], null, 2), 'info');
    }

    /**
     * Generate network ID
     * @returns {string} Random network ID
     */
    generateNetworkId() {
        const chars = '0123456789abcdef';
        let id = '';
        for (let i = 0; i < 12; i++) {
            id += chars[Math.floor(Math.random() * chars.length)];
        }
        return id;
    }

    /**
     * Generate MAC address
     * @returns {string} Random MAC address
     */
    generateMacAddress() {
        const chars = '0123456789abcdef';
        let mac = '';
        for (let i = 0; i < 6; i++) {
            if (i > 0) mac += ':';
            mac += chars[Math.floor(Math.random() * chars.length)];
            mac += chars[Math.floor(Math.random() * chars.length)];
        }
        return mac;
    }

    /**
     * Docker version command
     * @param {HTMLElement} output - Output element
     */
    dockerVersion(output) {
        this.addTerminalLine(output, 'Client: Docker Engine - Community', 'info');
        this.addTerminalLine(output, ' Version:           28.0.4', 'info');
        this.addTerminalLine(output, ' API version:       1.48', 'info');
        this.addTerminalLine(output, ' Go version:        go1.23.7', 'info');
        this.addTerminalLine(output, ' Git commit:        b8034c0', 'info');
        this.addTerminalLine(output, ' Built:             Tue Mar 25 15:07:11 2025', 'info');
        this.addTerminalLine(output, ' OS/Arch:           linux/amd64', 'info');
        this.addTerminalLine(output, ' Context:           default', 'info');
        this.addTerminalLine(output, '', 'blank');
        this.addTerminalLine(output, 'Server: Docker Engine - Community', 'info');
        this.addTerminalLine(output, ' Engine:', 'info');
        this.addTerminalLine(output, '  Version:          28.0.4', 'info');
        this.addTerminalLine(output, '  API version:      1.48 (minimum version 1.24)', 'info');
        this.addTerminalLine(output, '  Go version:       go1.23.7', 'info');
        this.addTerminalLine(output, '  Git commit:       6430e49', 'info');
        this.addTerminalLine(output, '  Built:            Tue Mar 25 15:07:11 2025', 'info');
        this.addTerminalLine(output, '  OS/Arch:          linux/amd64', 'info');
        this.addTerminalLine(output, '  Experimental:     false', 'info');
        this.addTerminalLine(output, ' containerd:', 'info');
        this.addTerminalLine(output, '  Version:          v2.2.1', 'info');
        this.addTerminalLine(output, '  GitCommit:        dea7da592f5d1d2b7755e3a161be07f43fad8f75', 'info');
        this.addTerminalLine(output, ' runc:', 'info');
        this.addTerminalLine(output, '  Version:          1.3.4', 'info');
        this.addTerminalLine(output, '  GitCommit:        v1.3.4-0-gd6d73eb8', 'info');
        this.addTerminalLine(output, ' docker-init:', 'info');
        this.addTerminalLine(output, '  Version:          0.19.0', 'info');
        this.addTerminalLine(output, '  GitCommit:        de40ad0', 'info');
    }
}

// Initialize global instance
window.dockerTerminal = new DockerTerminal();
