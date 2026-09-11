/**
 * ============================================
 * NAS MANAGER
 * ============================================
 * Handles NAS (Non-Access Stratum) registration process
 * 
 * Responsibilities:
 * - Manage NAS panel visibility
 * - Handle NAS step execution
 * - Display JSON messages
 * - Coordinate ball animations on canvas
 */

class NASManager {
    constructor() {
        this.isActive = false;
        this.currentStep = 0;
        this.steps = this.initializeSteps();
        this.animationBall = null;
        this.animationInProgress = false;
    }

    /**
     * Initialize NAS steps with JSON messages
     */
    initializeSteps() {
        return [
            {
                number: 1,
                title: "UE → gNB → AMF",
                description: "Registration Request",
                source: "UE",
                destination: "AMF",
                via: "gNB",
                json: {
                    "step": 1,
                    "source": "UE",
                    "destination": "AMF",
                    "message": "RegistrationRequest",
                    "data": {
                        "id": "SUCI",
                        "nssai": 1
                    }
                }
            },
            {
                number: 2,
                title: "AMF → gNB → UE",
                description: "Identity Request",
                source: "AMF",
                destination: "UE",
                via: "gNB",
                json: {
                    "step": 2,
                    "source": "AMF",
                    "destination": "UE",
                    "message": "IdentityRequest",
                    "data": {
                        "ask": "SUPI"
                    }
                }
            },
            {
                number: 3,
                title: "UE → gNB → AMF",
                description: "Identity Response",
                source: "UE",
                destination: "AMF",
                via: "gNB",
                json: {
                    "step": 3,
                    "source": "UE",
                    "destination": "AMF",
                    "message": "IdentityResponse",
                    "data": {
                        "supi": "IMSI"
                    }
                }
            },
            {
                number: 4,
                title: "AMF → AUSF",
                description: "Authentication Request",
                source: "AMF",
                destination: "AUSF",
                json: {
                    "step": 4,
                    "source": "AMF",
                    "destination": "AUSF",
                    "message": "AuthenticationRequest",
                    "data": {
                        "supi": "IMSI",
                        "method": "5G-AKA"
                    }
                }
            },
            {
                number: 5,
                title: "AUSF → UDM",
                description: "Security Data Request",
                source: "AUSF",
                destination: "UDM",
                json: {
                    "step": 5,
                    "source": "AUSF",
                    "destination": "UDM",
                    "message": "SecurityDataRequest",
                    "data": {
                        "supi": "IMSI"
                    }
                }
            },
            {
                number: 6,
                title: "UDM → AUSF",
                description: "Authentication Vectors",
                source: "UDM",
                destination: "AUSF",
                json: {
                    "step": 6,
                    "source": "UDM",
                    "destination": "AUSF",
                    "message": "AuthenticationVectors",
                    "data": {
                        "rand": "...",
                        "autn": "..."
                    }
                }
            },
            {
                number: 7,
                title: "AUSF → AMF",
                description: "Authentication Challenge",
                source: "AUSF",
                destination: "AMF",
                json: {
                    "step": 7,
                    "source": "AUSF",
                    "destination": "AMF",
                    "message": "AuthenticationChallenge",
                    "data": {
                        "rand": "...",
                        "autn": "..."
                    }
                }
            },
            {
                number: 8,
                title: "AMF → gNB → UE",
                description: "NAS Authentication Request",
                source: "AMF",
                destination: "UE",
                via: "gNB",
                json: {
                    "step": 8,
                    "source": "AMF",
                    "destination": "UE",
                    "message": "NASAuthenticationRequest",
                    "data": {
                        "rand": "...",
                        "autn": "..."
                    }
                }
            },
            {
                number: 9,
                title: "UE → gNB → AMF",
                description: "Authentication Response (RES*)",
                source: "UE",
                destination: "AMF",
                via: "gNB",
                json: {
                    "step": 9,
                    "source": "UE",
                    "destination": "AMF",
                    "message": "AuthenticationResponse",
                    "data": {
                        "res*": "OK"
                    }
                }
            },
            {
                number: 10,
                title: "AMF → gNB → UE",
                description: "Security Mode Command",
                source: "AMF",
                destination: "UE",
                via: "gNB",
                json: {
                    "step": 10,
                    "source": "AMF",
                    "destination": "UE",
                    "message": "SecurityModeCommand",
                    "data": {
                        "cipher": "NEA2",
                        "integrity": "NIA2"
                    }
                }
            },
            {
                number: 11,
                title: "UE → gNB → AMF",
                description: "Security Mode Complete",
                source: "UE",
                destination: "AMF",
                via: "gNB",
                json: {
                    "step": 11,
                    "source": "UE",
                    "destination": "AMF",
                    "message": "SecurityModeComplete",
                    "data": {
                        "secure": "ON"
                    }
                }
            },
            {
                number: 12,
                title: "AMF → gNB → UE",
                description: "Registration Accept",
                source: "AMF",
                destination: "UE",
                via: "gNB",
                json: {
                    "step": 12,
                    "source": "AMF",
                    "destination": "UE",
                    "message": "RegistrationAccept",
                    "data": {
                        "5gGUTI": "X"
                    }
                }
            },
            {
                number: 13,
                title: "UE → gNB → AMF",
                description: "Registration Complete",
                source: "UE",
                destination: "AMF",
                via: "gNB",
                json: {
                    "step": 13,
                    "source": "UE",
                    "destination": "AMF",
                    "message": "RegistrationComplete",
                    "data": {
                        "status": "OK"
                    }
                }
            }
        ];
    }

    /**
     * Initialize NAS manager
     */
    init() {
        const btnNAS = document.getElementById('btn-nas');
        const btnCloseNAS = document.getElementById('btn-close-nas-panel');
        const btnCloseJSON = document.getElementById('btn-close-json-panel');

        if (btnNAS) {
            btnNAS.addEventListener('click', () => this.openNASPanel());
        }

        if (btnCloseNAS) {
            btnCloseNAS.addEventListener('click', () => this.closeNASPanel());
        }

        if (btnCloseJSON) {
            btnCloseJSON.addEventListener('click', () => this.closeJSONPanel());
        }

        this.renderSteps();
        console.log('✅ NASManager initialized');
    }

    /**
     * Check whether all required NFs (core + gNB + UE) are deployed and stable
     * @returns {{ ok: boolean, missing: string[] }}
     */
    checkDeploymentReady() {
        const required = ['AMF', 'SMF', 'UPF', 'NRF', 'AUSF', 'UDM', 'UDR', 'gNB', 'UE'];
        const allNFs = window.dataStore?.getAllNFs() || [];
        const missing = [];

        for (const type of required) {
            const nf = allNFs.find(n => n.type === type);
            if (!nf) {
                missing.push(type);
            } else if (nf.status !== 'stable') {
                missing.push(`${type} (not stable)`);
            }
        }

        return { ok: missing.length === 0, missing };
    }

    /**
     * Open NAS panel and hide configuration panel
     */
    openNASPanel() {
        // Guard: core + gNB + UE must all be deployed and stable
        const { ok, missing } = this.checkDeploymentReady();
        if (!ok) {
            const missingList = missing.join(', ');
            alert(
                `⚠️ NAS process cannot start.\n\n` +
                `The following network functions are not ready:\n${missingList}\n\n` +
                `Please deploy the full core network, gNB, and UE first:\n` +
                `  docker compose -f docker-compose.yml up -d\n` +
                `  docker compose -f docker-compose-gnb.yml up -d\n` +
                `  docker compose -f docker-compose-ue.yml up -d`
            );
            return;
        }

        const configPanel = document.getElementById('config-panel');
        const nasPanel = document.getElementById('nas-panel');
        const nfPanel = document.getElementById('nf-panel');
        const jsonPanel = document.getElementById('json-message-panel');

        if (configPanel) configPanel.style.display = 'none';
        if (nasPanel) nasPanel.style.display = 'block';
        if (nfPanel) nfPanel.style.display = 'none';
        if (jsonPanel) jsonPanel.style.display = 'block';

        this.isActive = true;
        this.currentStep = 0;
        this.resetSteps();
    }

    /**
     * Close NAS panel and show configuration panel
     */
    closeNASPanel() {
        const configPanel = document.getElementById('config-panel');
        const nasPanel = document.getElementById('nas-panel');
        const nfPanel = document.getElementById('nf-panel');
        const jsonPanel = document.getElementById('json-message-panel');

        if (configPanel) configPanel.style.display = 'block';
        if (nasPanel) nasPanel.style.display = 'none';
        if (nfPanel) nfPanel.style.display = 'block';
        if (jsonPanel) jsonPanel.style.display = 'none';

        this.isActive = false;
        this.stopAnimation();
    }

    /**
     * Close JSON panel and show network function panel
     */
    closeJSONPanel() {
        const nfPanel = document.getElementById('nf-panel');
        const jsonPanel = document.getElementById('json-message-panel');

        if (nfPanel) nfPanel.style.display = 'block';
        if (jsonPanel) jsonPanel.style.display = 'none';
    }

    /**
     * Render NAS step buttons
     */
    renderSteps() {
        const stepsList = document.getElementById('nas-steps-list');
        if (!stepsList) return;

        stepsList.innerHTML = '';

        this.steps.forEach((step, index) => {
            const stepBtn = document.createElement('button');
            stepBtn.className = 'nas-step-btn';
            stepBtn.id = `nas-step-${step.number}`;
            stepBtn.innerHTML = `
                <span class="nas-step-number">Step ${step.number}:</span>
                <strong>${step.title}</strong><br>
                <small style="color: var(--text-secondary);">${step.description}</small>
            `;
            stepBtn.addEventListener('click', () => this.executeStep(index));
            // Only enable first step initially
            if (index > 0) {
                stepBtn.disabled = true;
            }
            stepsList.appendChild(stepBtn);
        });
    }

    /**
     * Reset all steps to initial state
     */
    resetSteps() {
        this.steps.forEach((step, index) => {
            const stepBtn = document.getElementById(`nas-step-${step.number}`);
            if (stepBtn) {
                stepBtn.classList.remove('active', 'completed');
                // Only enable first step
                stepBtn.disabled = index > 0;
            }
        });
        this.currentStep = 0;
    }

    /**
     * Execute a NAS step
     */
    async executeStep(stepIndex) {
        if (this.animationInProgress) {
            console.log('⚠️ Animation already in progress');
            return;
        }

        if (stepIndex < 0 || stepIndex >= this.steps.length) {
            console.error('❌ Invalid step index');
            return;
        }

        const step = this.steps[stepIndex];
        const stepBtn = document.getElementById(`nas-step-${step.number}`);

        if (!stepBtn || stepBtn.disabled) {
            return;
        }

        // Mark step as active
        stepBtn.classList.add('active');
        stepBtn.disabled = true;

        // Display JSON message
        this.displayJSONMessage(step);

        // Start animation
        await this.animateStep(step);

        // Mark step as completed
        stepBtn.classList.remove('active');
        stepBtn.classList.add('completed');

        // Enable next step
        if (stepIndex + 1 < this.steps.length) {
            const nextStepBtn = document.getElementById(`nas-step-${this.steps[stepIndex + 1].number}`);
            if (nextStepBtn) {
                nextStepBtn.disabled = false;
            }
        }
    }

    /**
     * Display JSON message for a step
     */
    displayJSONMessage(step) {
        const jsonContent = document.getElementById('json-message-content');
        if (!jsonContent) return;

        const route = step.via 
            ? `${step.source} → ${step.via} → ${step.destination}`
            : `${step.source} → ${step.destination}`;

        // Prepare JSON for display: hide internal routing fields (step, source, destination)
        const rawJson = step.json || {};
        const displayJson = JSON.parse(JSON.stringify(rawJson)); // deep clone
        delete displayJson.step;
        delete displayJson.source;
        delete displayJson.destination;

        const jsonHTML = `
            <div class="json-message">
                <div class="json-message-header">
                    <span class="json-message-title">Step ${step.number}: ${step.description}</span>
                    <span class="json-message-route">${route}</span>
                </div>
                <div style="margin-top: 10px; margin-bottom: 10px; padding: 8px; background: rgba(52, 152, 219, 0.1); border-radius: 4px; font-size: 12px; color: var(--text-secondary);">
                    <strong>Source → Destination:</strong><br>
                    ${route}
                </div>
                <pre>${JSON.stringify(displayJson, null, 2)}</pre>
            </div>
        `;

        jsonContent.innerHTML = jsonHTML;
        jsonContent.scrollTop = 0;
    }

    /**
     * Animate ball movement for a step
     */
    async animateStep(step) {
        this.animationInProgress = true;

        try {
            // Find source and destination NFs on canvas
            const sourceNF = this.findNFOnCanvas(step.source);
            const destinationNF = this.findNFOnCanvas(step.destination);
            const viaNF = step.via ? this.findNFOnCanvas(step.via) : null;

            if (!sourceNF || !destinationNF) {
                console.warn('⚠️ Could not find NFs on canvas for animation');
                // Still show JSON message even if animation fails
                await this.delay(2000);
                this.animationInProgress = false;
                return;
            }

            // Calculate source position
            const sourcePos = {
                x: sourceNF.position.x + 20,
                y: sourceNF.position.y + 20
            };

            // Check if connected via bus
            const busPath = this.findBusPath(sourceNF, destinationNF);

            if (busPath) {
                // Animate through bus: source -> bus entry -> bus exit -> destination
                await this.animateThroughBus(sourcePos, busPath);
            } else if (viaNF) {
                // Two-part animation: source -> via -> destination (for UE -> gNB -> AMF cases)
                const viaPos = {
                    x: viaNF.position.x + 20,
                    y: viaNF.position.y + 20
                };
                
                // Animate to via point
                await this.animateBall(sourcePos, viaPos, 1500);
                
                // Animate from via to destination
                const destPos = {
                    x: destinationNF.position.x + 20,
                    y: destinationNF.position.y + 20
                };
                await this.animateBall(viaPos, destPos, 1500);
            } else {
                // Direct animation: source -> destination (fallback)
                const destPos = {
                    x: destinationNF.position.x + 20,
                    y: destinationNF.position.y + 20
                };
                await this.animateBall(sourcePos, destPos, 2000);
            }

        } catch (error) {
            console.error('❌ Animation error:', error);
        } finally {
            this.animationInProgress = false;
        }
    }

    /**
     * Find bus path between two NFs
     * @param {Object} sourceNF - Source Network Function
     * @param {Object} destinationNF - Destination Network Function
     * @returns {Object|null} Bus path with entry and exit points, or null if no bus connection
     */
    findBusPath(sourceNF, destinationNF) {
        if (!window.dataStore) return null;

        // Get bus connections for both NFs
        const sourceBusConnections = window.dataStore.getBusConnectionsForNF(sourceNF.id) || [];
        const destBusConnections = window.dataStore.getBusConnectionsForNF(destinationNF.id) || [];

        // Find common bus
        for (const sourceBusConn of sourceBusConnections) {
            for (const destBusConn of destBusConnections) {
                if (sourceBusConn.busId === destBusConn.busId) {
                    const bus = window.dataStore.getBusById(sourceBusConn.busId);
                    if (bus) {
                        // Calculate connection points on bus
                        const sourceNFCenter = {
                            x: sourceNF.position.x + 20,
                            y: sourceNF.position.y + 20
                        };
                        const destNFCenter = {
                            x: destinationNF.position.x + 20,
                            y: destinationNF.position.y + 20
                        };

                        // Find closest points on bus for source and destination
                        let busEntryX, busEntryY, busExitX, busExitY;

                        if (bus.orientation === 'horizontal') {
                            busEntryX = Math.max(bus.position.x, Math.min(sourceNFCenter.x, bus.position.x + bus.length));
                            busEntryY = bus.position.y;
                            busExitX = Math.max(bus.position.x, Math.min(destNFCenter.x, bus.position.x + bus.length));
                            busExitY = bus.position.y;
                        } else {
                            busEntryX = bus.position.x;
                            busEntryY = Math.max(bus.position.y, Math.min(sourceNFCenter.y, bus.position.y + bus.length));
                            busExitX = bus.position.x;
                            busExitY = Math.max(bus.position.y, Math.min(destNFCenter.y, bus.position.y + bus.length));
                        }

                        return {
                            bus: bus,
                            entryPoint: { x: busEntryX, y: busEntryY },
                            exitPoint: { x: busExitX, y: busExitY },
                            destination: destNFCenter
                        };
                    }
                }
            }
        }

        return null;
    }

    /**
     * Animate ball through bus path
     * @param {Object} sourcePos - Source position
     * @param {Object} busPath - Bus path object with entry, exit, and destination points
     */
    async animateThroughBus(sourcePos, busPath) {
        // Step 1: Animate from source NF to bus entry point
        await this.animateBall(sourcePos, busPath.entryPoint, 800);

        // Step 2: Animate along the bus line from entry to exit
        await this.animateBall(busPath.entryPoint, busPath.exitPoint, 1200);

        // Step 3: Animate from bus exit point to destination NF
        await this.animateBall(busPath.exitPoint, busPath.destination, 800);
    }

    /**
     * Animate ball from source to destination
     */
    async animateBall(sourcePos, targetPos, duration) {
        return new Promise((resolve) => {
            const startTime = Date.now();
            const ball = {
                x: sourcePos.x,
                y: sourcePos.y,
                visible: true
            };

            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);

                // Easing function (ease-in-out)
                const eased = progress < 0.5
                    ? 2 * progress * progress
                    : 1 - Math.pow(-2 * progress + 2, 2) / 2;

                ball.x = sourcePos.x + (targetPos.x - sourcePos.x) * eased;
                ball.y = sourcePos.y + (targetPos.y - sourcePos.y) * eased;

                // Store ball for rendering
                window.nasAnimationBall = ball;

                // Trigger canvas redraw
                if (window.canvasRenderer) {
                    window.canvasRenderer.render();
                }

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    // Animation complete - wait a bit then remove ball
                    setTimeout(() => {
                        window.nasAnimationBall = null;
                        if (window.canvasRenderer) {
                            window.canvasRenderer.render();
                        }
                        resolve();
                    }, 200);
                }
            };

            animate();
        });
    }

    /**
     * Find NF on canvas by type
     */
    findNFOnCanvas(nfType) {
        if (!window.dataStore) return null;

        const allNFs = window.dataStore.getAllNFs();
        return allNFs.find(nf => nf.type === nfType);
    }

    /**
     * Stop current animation
     */
    stopAnimation() {
        window.nasAnimationBall = null;
        this.animationInProgress = false;
        if (window.canvasRenderer) {
            window.canvasRenderer.render();
        }
    }

    /**
     * Delay helper
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

