/**
 * InputHandler - Manages keyboard, touch, and gamepad input
 */
class InputHandler {
    constructor(gameEngine) {
        this.gameEngine = gameEngine;
        this.horizontalInput = 0;
        this.verticalInput = 0;
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.touchThreshold = 30;
        this.keyState = {};
        this.lastLaneChange = 0;
        this.laneChangeDelay = 200; // ms
        this.isMobile = this.checkIfMobile();
        
        // Initialize input handlers
        this.initKeyboardInput();
        this.initTouchInput();
        this.initGamepadInput();
    }

    /**
     * Initialize keyboard input handlers
     */
    initKeyboardInput() {
        // Key down handler
        window.addEventListener('keydown', (e) => {
            this.keyState[e.code] = true;
            
            // Get current keyboard layout
            const layout = CONFIG.keyboard.layouts[CONFIG.keyboard.currentLayout];
            
            // Handle lane changes on key press (not hold)
            if (e.code === layout.left || e.code === 'ArrowLeft') { 
                this.handleLaneChange(-1);
            } else if (e.code === layout.right || e.code === 'ArrowRight') {
                this.handleLaneChange(1);
            }
            
            // Handle pause
            if (e.code === 'Escape' || e.code === 'KeyP') {
                if (this.gameEngine.isPlaying && !this.gameEngine.isGameOver) {
                    if (this.gameEngine.isPaused) {
                        // Resume game
                        window.uiController.resumeGame();
                    } else {
                        // Pause game
                        window.uiController.pauseGame();
                    }
                }
            }
        });
        
        // Key up handler
        window.addEventListener('keyup', (e) => {
            this.keyState[e.code] = false;
        });
    }

    /**
     * Initialize touch input handlers
     */
    initTouchInput() {
        const gameCanvas = document.getElementById('game-canvas');
        if (!gameCanvas) return;
        
        // Touch start handler
        gameCanvas.addEventListener('touchstart', (e) => {
            if (!this.gameEngine.isPlaying || this.gameEngine.isPaused) return;
            
            const touch = e.touches[0];
            this.touchStartX = touch.clientX;
            this.touchStartY = touch.clientY;
        });
        
        // Touch move handler
        gameCanvas.addEventListener('touchmove', (e) => {
            if (!this.gameEngine.isPlaying || this.gameEngine.isPaused) return;
            
            const touch = e.touches[0];
            const deltaX = touch.clientX - this.touchStartX;
            
            // Update horizontal input based on touch movement
            this.horizontalInput = Math.max(-1, Math.min(1, deltaX / 100));
            
            // Handle lane changes based on threshold
            if (Math.abs(deltaX) > this.touchThreshold) {
                const direction = deltaX > 0 ? 1 : -1;
                this.handleLaneChange(direction);
                
                // Reset touch start to allow multiple swipes
                this.touchStartX = touch.clientX;
            }
            
            // Prevent default to avoid page scrolling
            e.preventDefault();
        });
        
        // Touch end handler
        gameCanvas.addEventListener('touchend', () => {
            if (!this.gameEngine.isPlaying || this.gameEngine.isPaused) return;
            
            // Reset input when touch ends
            this.horizontalInput = 0;
        });
    }

    /**
     * Initialize gamepad input handlers
     */
    initGamepadInput() {
        // Check for gamepad API support
        if ('getGamepads' in navigator) {
            // Poll for gamepad input
            const gamepadPollingInterval = setInterval(() => {
                if (!this.gameEngine.isPlaying || this.gameEngine.isPaused) return;
                
                const gamepads = navigator.getGamepads();
                if (gamepads) {
                    for (const gamepad of gamepads) {
                        if (gamepad) {
                            this.processGamepadInput(gamepad);
                        }
                    }
                }
            }, 16); // ~60fps polling
            
            // Clean up interval when window loses focus
            window.addEventListener('blur', () => {
                clearInterval(gamepadPollingInterval);
            });
            
            // Restart interval when window gains focus
            window.addEventListener('focus', () => {
                clearInterval(gamepadPollingInterval);
                this.initGamepadInput();
            });
        }
    }

    /**
     * Process gamepad input
     * @param {Gamepad} gamepad - Gamepad object
     */
    processGamepadInput(gamepad) {
        // Handle analog sticks and d-pad
        const leftStickX = gamepad.axes[0];
        const dpadRight = gamepad.buttons[15]?.pressed;
        const dpadLeft = gamepad.buttons[14]?.pressed;
        
        // Update horizontal input
        if (Math.abs(leftStickX) > 0.1) {
            this.horizontalInput = leftStickX;
            
            // Handle lane changes
            if (leftStickX > 0.7) {
                this.handleLaneChange(1);
            } else if (leftStickX < -0.7) {
                this.handleLaneChange(-1);
            }
        } else if (dpadRight) {
            this.handleLaneChange(1);
            this.horizontalInput = 0.5;
        } else if (dpadLeft) {
            this.handleLaneChange(-1);
            this.horizontalInput = -0.5;
        } else {
            // Reset horizontal input if no gamepad input
            this.horizontalInput = 0;
        }
        
        // Handle pause button
        if (gamepad.buttons[9]?.pressed) { // Start button
            if (this.gameEngine.isPlaying && !this.gameEngine.isGameOver) {
                if (this.gameEngine.isPaused) {
                    window.uiController.resumeGame();
                } else {
                    window.uiController.pauseGame();
                }
            }
        }
    }

    /**
     * Update input state (call this in game loop)
     */
    update() {
        // Get current keyboard layout
        const layout = CONFIG.keyboard.layouts[CONFIG.keyboard.currentLayout];
        
        // Update horizontal input from keyboard
        let horizontalInput = 0;
        if (this.keyState[layout.left] || this.keyState['ArrowLeft']) {
            horizontalInput -= 1;
        }
        if (this.keyState[layout.right] || this.keyState['ArrowRight']) {
            horizontalInput += 1;
        }
        
        // If keyboard is being used, override other input methods
        if (horizontalInput !== 0) {
            this.horizontalInput = horizontalInput;
        }
        
        // Apply horizontal input to game engine
        if (this.gameEngine.isPlaying && !this.gameEngine.isPaused) {
            // Adjust ship speed based on forward/backward input
            if (this.keyState[layout.up] || this.keyState['ArrowUp']) {
                this.gameEngine.setTargetSpeed(1.5);
            } else if (this.keyState[layout.down] || this.keyState['ArrowDown']) {
                this.gameEngine.setTargetSpeed(0.5);
            } else {
                this.gameEngine.setTargetSpeed(1.0);
            }
        }
    }

    /**
     * Handle lane change
     * @param {number} direction - Direction (-1 for left, 1 for right)
     */
    handleLaneChange(direction) {
        // Check if enough time has passed since last lane change
        const now = Date.now();
        if (now - this.lastLaneChange < this.laneChangeDelay) {
            return;
        }
        
        // Update last lane change time
        this.lastLaneChange = now;
        
        // Change lane in game engine
        if (this.gameEngine.isPlaying && !this.gameEngine.isPaused) {
            this.gameEngine.changeLane(-direction); // Fix inverted controls by negating direction
        }
    }

    /**
     * Check if the device is mobile
     * @returns {boolean} - True if mobile device
     */
    checkIfMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
            || window.innerWidth < 768;
    }
}