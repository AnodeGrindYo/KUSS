/**
 * UIController - Manages UI interactions and updates
 */
class UIController {
    constructor(gameEngine) {
        this.gameEngine = gameEngine;
        this.screens = {
            menu: document.getElementById('menu-screen'),
            game: document.getElementById('game-screen'),
            results: document.getElementById('results-screen'),
            loading: document.getElementById('loading-overlay')
        };
        this.gameUI = {
            scoreDisplay: document.getElementById('score'),
            multiplierDisplay: document.getElementById('multiplier'),
            progressBar: document.getElementById('progress-bar'),
            pauseMenu: document.getElementById('pause-menu'),
            pauseButton: document.getElementById('pause-button')
        };
        this.menuUI = {
            audioInput: document.getElementById('audio-input'),
            startButton: document.getElementById('start-button'),
            optionsButton: document.getElementById('options-button'),
            currentTrack: document.getElementById('current-track'),
            trackDuration: document.getElementById('track-duration')
        };
        this.resultsUI = {
            finalScore: document.getElementById('final-score'),
            playAgainButton: document.getElementById('play-again-button'),
            menuButton: document.getElementById('menu-button')
        };
        this.pauseUI = {
            resumeButton: document.getElementById('resume-button'),
            restartButton: document.getElementById('restart-button'),
            exitButton: document.getElementById('exit-button')
        };
        this.loadingUI = {
            loadingText: document.getElementById('loading-text')
        };
        
        // Initialize event handlers
        this.initEventHandlers();
    }

    /**
     * Initialize all UI event handlers
     */
    initEventHandlers() {
        // Title animation
        document.getElementById('game-title').addEventListener('click', () => {
            const titleExpansion = document.getElementById('title-expansion');
            titleExpansion.classList.toggle('active');
        });
        
        // Menu screen handlers
        this.menuUI.audioInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                this.handleAudioFileSelected(e.target.files[0]);
            }
        });
        
        this.menuUI.startButton.addEventListener('click', () => {
            this.startGame();
        });
        
        this.menuUI.optionsButton.addEventListener('click', () => {
            this.showOptionsMenu();
        });
        
        // Game screen handlers
        this.gameUI.pauseButton.addEventListener('click', () => {
            this.pauseGame();
        });
        
        // Pause menu handlers
        this.pauseUI.resumeButton.addEventListener('click', () => {
            this.resumeGame();
        });
        
        this.pauseUI.restartButton.addEventListener('click', () => {
            this.restartGame();
        });
        
        this.pauseUI.exitButton.addEventListener('click', () => {
            this.exitToMenu();
        });
        
        // Add event listeners for new pause menu buttons
        document.getElementById('change-track-button').addEventListener('click', () => {
            this.exitToMenu();
            // Trigger file input click to select a new track
            setTimeout(() => this.menuUI.audioInput.click(), 300);
        });
        
        document.getElementById('options-from-pause-button').addEventListener('click', () => {
            this.gameUI.pauseMenu.style.display = 'none';
            this.showOptionsMenu();
            // Add back button specifically for returning to game
            if (this.optionsMenu) {
                const backButton = document.createElement('button');
                backButton.className = 'button';
                backButton.textContent = 'Back to Game';
                backButton.addEventListener('click', () => {
                    this.optionsMenu.classList.remove('active');
                    this.pauseGame();
                });
                
                const buttonContainer = this.optionsMenu.querySelector('.option-buttons');
                buttonContainer.appendChild(backButton);
            }
        });
        
        // Results screen handlers
        this.resultsUI.playAgainButton.addEventListener('click', () => {
            this.restartGame();
        });
        
        this.resultsUI.menuButton.addEventListener('click', () => {
            this.exitToMenu();
        });
    }

    /**
     * Handle audio file selection
     * @param {File} file - The selected audio file
     */
    handleAudioFileSelected(file) {
        // Show loading screen
        this.showLoadingScreen('Analyzing track...');
        
        // Load and analyze the track
        this.gameEngine.loadTrack(file)
            .then(trackInfo => {
                // Update UI with track info
                this.menuUI.currentTrack.textContent = file.name;
                this.menuUI.trackDuration.textContent = this.formatTime(trackInfo.duration);
                
                // Enable start button
                this.menuUI.startButton.disabled = false;
                
                // Hide loading screen
                this.hideLoadingScreen();
            })
            .catch(error => {
                console.error('Error loading track:', error);
                alert('Failed to load audio file. Please try another file.');
                this.hideLoadingScreen();
            });
    }

    /**
     * Start a new game
     */
    startGame() {
        // Show loading screen before starting
        this.showLoadingScreen('Preparing game...');
        
        // Start the game with a small delay to ensure loading screen is visible
        setTimeout(() => {
            if (this.gameEngine.startGame()) {
                // Switch to game screen
                this.showScreen('game');
                this.hideLoadingScreen();
            } else {
                alert('Failed to start game. Please try again.');
                this.hideLoadingScreen();
                this.showScreen('menu');
            }
        }, 500);
    }

    /**
     * Pause the current game
     */
    pauseGame() {
        this.gameEngine.pauseGame();
        this.gameUI.pauseMenu.style.display = 'flex';
    }

    /**
     * Resume the paused game
     */
    resumeGame() {
        this.gameUI.pauseMenu.style.display = 'none';
        this.gameEngine.resumeGame();
    }

    /**
     * Restart the current game
     */
    restartGame() {
        this.gameUI.pauseMenu.style.display = 'none';
        this.showScreen('game');
        this.gameEngine.startGame();
    }

    /**
     * Exit to the main menu
     */
    exitToMenu() {
        this.gameUI.pauseMenu.style.display = 'none';
        this.showScreen('menu');
        
        // End the current game
        if (this.gameEngine.isPlaying) {
            this.gameEngine.endGame();
        }
    }

    /**
     * Show the results screen
     * @param {number} finalScore - Final score to display
     */
    showResultsScreen(finalScore) {
        this.resultsUI.finalScore.textContent = finalScore.toLocaleString();
        this.showScreen('results');
    }

    /**
     * Show the specified screen, hide others
     * @param {string} screenName - Name of screen to show ('menu', 'game', 'results')
     */
    showScreen(screenName) {
        // Hide all screens
        for (const key in this.screens) {
            if (this.screens[key] && key !== 'loading') {
                this.screens[key].classList.remove('active');
            }
        }
        
        // Show the requested screen
        if (this.screens[screenName]) {
            this.screens[screenName].classList.add('active');
        }
    }

    /**
     * Show the loading overlay
     * @param {string} message - Loading message to display
     */
    showLoadingScreen(message = 'Loading...') {
        if (this.loadingUI.loadingText) {
            this.loadingUI.loadingText.textContent = message;
        }
        if (this.screens.loading) {
            this.screens.loading.style.display = 'flex';
        }
    }

    /**
     * Hide the loading overlay
     */
    hideLoadingScreen() {
        if (this.screens.loading) {
            this.screens.loading.style.display = 'none';
        }
    }

    /**
     * Update loading progress
     * @param {number} progress - Progress value (0-1)
     */
    updateLoadingProgress(progress) {
        const percentage = Math.floor(progress * 100);
        if (this.loadingUI.loadingText) {
            this.loadingUI.loadingText.textContent = `Analyzing track... ${percentage}%`;
        }
    }

    /**
     * Update score display
     * @param {number} score - Current score
     */
    updateScore(score) {
        if (this.gameUI.scoreDisplay) {
            this.gameUI.scoreDisplay.textContent = score.toLocaleString();
        }
    }

    /**
     * Update multiplier display
     * @param {number} multiplier - Current score multiplier
     */
    updateMultiplier(multiplier) {
        if (this.gameUI.multiplierDisplay) {
            this.gameUI.multiplierDisplay.textContent = `x${multiplier.toFixed(1)}`;
        }
    }

    /**
     * Update progress bar
     * @param {number} progress - Progress value (0-1)
     */
    updateProgressBar(progress) {
        if (this.gameUI.progressBar) {
            this.gameUI.progressBar.style.width = `${progress * 100}%`;
        }
    }

    /**
     * Format time in seconds to mm:ss format
     * @param {number} seconds - Time in seconds
     * @returns {string} - Formatted time string
     */
    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Show options menu
     */
    showOptionsMenu() {
        // Create options menu if it doesn't exist yet
        if (!this.optionsMenu) {
            this.optionsMenu = document.createElement('div');
            this.optionsMenu.id = 'options-menu';
            this.optionsMenu.className = 'screen';
            
            this.optionsMenu.innerHTML = `
                <h2>Options</h2>
                
                <div class="option-group">
                    <h3>Keyboard Layout</h3>
                    <div class="option-controls">
                        <select id="keyboard-layout">
                            <option value="arrows">Arrow Keys</option>
                            <option value="wasd">WASD (QWERTY)</option>
                            <option value="zqsd">ZQSD (AZERTY)</option>
                        </select>
                    </div>
                </div>
                
                <div class="option-buttons">
                    <button id="save-options" class="button primary-button">Save</button>
                    <button id="cancel-options" class="button">Cancel</button>
                </div>
            `;
            
            // Add to DOM
            document.getElementById('game-container').appendChild(this.optionsMenu);
            
            // Set up event handlers
            document.getElementById('save-options').addEventListener('click', () => {
                // Save keyboard layout
                CONFIG.keyboard.currentLayout = document.getElementById('keyboard-layout').value;
                this.hideOptionsMenu();
            });
            
            document.getElementById('cancel-options').addEventListener('click', () => {
                this.hideOptionsMenu();
            });
        }
        
        // Set current values
        document.getElementById('keyboard-layout').value = CONFIG.keyboard.currentLayout;
        
        // Show the menu
        this.optionsMenu.classList.add('active');
    }

    /**
     * Hide options menu
     */
    hideOptionsMenu() {
        if (this.optionsMenu) {
            this.optionsMenu.classList.remove('active');
        }
        this.showScreen('menu');
    }
}