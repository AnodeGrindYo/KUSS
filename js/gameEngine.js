/**
 * GameEngine - Core game engine for WebAudioSurf
 */
class GameEngine {
    constructor() {
        // Core components
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = null;
        
        // Game modules
        this.audioProcessor = null;
        this.trackGenerator = null;
        this.scoreManager = null;
        this.inputHandler = null;
        this.shaderManager = null;
        
        // Game objects
        this.ship = null;
        this.shipModel = null;
        this.shipLight = null;
        
        // Game state
        this.isInitialized = false;
        this.isPlaying = false;
        this.isPaused = false;
        this.isGameOver = false;
        this.playerSegment = 0;
        this.playerLane = 1; // Center lane by default
        this.playerOffset = 0;
        this.playerSpeed = 1;
        this.targetSpeed = 1;
        this.gameSpeed = CONFIG.game.speed;
        this.lastFrameTime = 0;
        this.deltaTime = 0;
        this.currentTrackIndex = -1;
        
        // Rendering settings
        this.usePostProcessing = !this.isMobileDevice();
        this.bloomPass = null;
        this.composer = null;
    }

    /**
     * Initialize the game engine
     * @param {HTMLElement} container - Container element for the game
     * @returns {boolean} - Success flag
     */
    init(container) {
        if (this.isInitialized) return true;

        try {
            // Initialize the 3D scene
            this.initScene();
            
            // Initialize the renderer
            this.initRenderer(container);
            
            // Initialize game components
            this.audioProcessor = new AudioProcessor();
            this.trackGenerator = new TrackGenerator(this.scene, this.audioProcessor);
            this.scoreManager = new ScoreManager();
            this.inputHandler = new InputHandler(this);
            this.shaderManager = new ShaderManager(this);
            
            // Create player ship
            this.createShip();
            
            // Initialize clock for timing
            this.clock = new THREE.Clock();
            
            this.isInitialized = true;
            return true;
        } catch (error) {
            console.error("Failed to initialize game engine:", error);
            return false;
        }
    }

    /**
     * Initialize the 3D scene
     */
    initScene() {
        // Create the scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(CONFIG.visuals.backgroundColor);
        
        // Create fog for distance fade
        this.scene.fog = new THREE.FogExp2(CONFIG.visuals.fogColor, CONFIG.visuals.fogDensity);
        
        // Create camera
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 3, 10);
        this.camera.lookAt(0, 0, -20);
        
        // Create ambient light
        const ambientLight = new THREE.AmbientLight(0x404040);
        this.scene.add(ambientLight);
        
        // Create directional light (simulating sun)
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(-10, 20, 10);
        directionalLight.castShadow = true;
        
        // Configure shadow properties
        directionalLight.shadow.mapSize.width = 1024;
        directionalLight.shadow.mapSize.height = 1024;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 50;
        
        this.scene.add(directionalLight);
        
        // Add distant stars
        this.addStarField();
    }

    /**
     * Initialize the WebGL renderer
     * @param {HTMLElement} container - Container element
     */
    initRenderer(container) {
        // Create renderer
        this.renderer = new THREE.WebGLRenderer({
            antialias: !this.isMobileDevice(), // Disable antialiasing on mobile for performance
            alpha: false
        });
        
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio > 1 ? 2 : 1); // Limit pixel ratio for performance
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        // Add canvas to container
        this.renderer.domElement.id = 'game-canvas';
        
        // Find or create the canvas element
        let canvas = container.querySelector('#game-canvas');
        if (canvas) {
            canvas.replaceWith(this.renderer.domElement);
        } else {
            container.appendChild(this.renderer.domElement);
        }
        
        // Initialize post-processing if enabled
        if (this.usePostProcessing) {
            this.initPostProcessing();
        }
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.handleResize(container);
        });
    }

    /**
     * Initialize post-processing effects
     */
    initPostProcessing() {
        // Skip on mobile devices for performance
        if (this.isMobileDevice()) {
            this.usePostProcessing = false;
            return;
        }
        
        try {
            // Import required modules from Three.js examples
            const { EffectComposer } = THREE.EffectComposer;
            const { RenderPass } = THREE.RenderPass;
            const { UnrealBloomPass } = THREE.UnrealBloomPass;
            const { ShaderPass } = THREE.ShaderPass;
            const { CopyShader } = THREE.CopyShader;
            
            // Create composer and render pass
            this.composer = new EffectComposer(this.renderer);
            const renderPass = new RenderPass(this.scene, this.camera);
            this.composer.addPass(renderPass);
            
            // Create bloom pass for glow effects
            this.bloomPass = new UnrealBloomPass(
                new THREE.Vector2(window.innerWidth, window.innerHeight),
                CONFIG.visuals.bloomIntensity, // Intensity
                0.4, // Radius
                0.85 // Threshold
            );
            this.composer.addPass(this.bloomPass);
            
            // Initialize shader manager
            if (this.shaderManager) {
                this.shaderManager.init();
            }
        } catch (error) {
            console.warn("Post-processing initialization failed:", error);
            this.usePostProcessing = false;
        }
    }

    /**
     * Handle window resize
     * @param {HTMLElement} container - Container element
     */
    handleResize(container) {
        if (!container) return;
        
        const width = container.clientWidth;
        const height = container.clientHeight;
        
        // Update camera aspect ratio
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        
        // Update renderer size
        this.renderer.setSize(width, height);
        
        // Update composer if using post-processing
        if (this.usePostProcessing && this.composer) {
            this.composer.setSize(width, height);
        }
        
        // Update shader manager
        if (this.shaderManager) {
            this.shaderManager.handleResize();
        }
    }

    /**
     * Create star field background
     */
    addStarField() {
        const starGeometry = new THREE.BufferGeometry();
        const starMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.1,
            transparent: true,
            opacity: 0.8
        });
        
        const starVertices = [];
        const starCount = 5000;
        const starDistance = 300;
        
        // Create random star positions
        for (let i = 0; i < starCount; i++) {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(Math.random() * 2 - 1);
            
            const x = starDistance * Math.sin(phi) * Math.cos(theta);
            const y = starDistance * Math.sin(phi) * Math.sin(theta);
            const z = starDistance * Math.cos(phi);
            
            starVertices.push(x, y, z);
        }
        
        starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
        
        const stars = new THREE.Points(starGeometry, starMaterial);
        this.scene.add(stars);
    }

    /**
     * Create player ship
     */
    createShip() {
        // Create ship geometry
        const shipGeometry = new THREE.Group();
        
        // Ship body
        const bodyGeometry = new THREE.ConeGeometry(0.5, 2, 8);
        bodyGeometry.rotateX(Math.PI / 2);
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: CONFIG.visuals.shipColor,
            emissive: CONFIG.visuals.shipColor,
            emissiveIntensity: 0.5,
            metalness: 0.8,
            roughness: 0.2
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        
        // Ship wings
        const wingGeometry = new THREE.BoxGeometry(2, 0.1, 1);
        const wingMaterial = new THREE.MeshStandardMaterial({
            color: 0x3399ff,
            metalness: 0.6,
            roughness: 0.4
        });
        const wings = new THREE.Mesh(wingGeometry, wingMaterial);
        wings.position.set(0, -0.2, 0.2);
        
        // Add parts to ship
        shipGeometry.add(body);
        shipGeometry.add(wings);
        
        // Create ship model
        this.shipModel = shipGeometry;
        this.shipModel.castShadow = true;
        
        // Add ship to scene
        this.ship = new THREE.Group();
        this.ship.add(this.shipModel);
        
        // Add a light attached to the ship
        this.shipLight = new THREE.PointLight(0x00aaff, 1, 10);
        this.shipLight.position.set(0, 1, -1);
        this.ship.add(this.shipLight);
        
        // Add ship to scene
        this.scene.add(this.ship);
        
        // Set initial position
        this.resetShipPosition();
    }

    /**
     * Reset ship to starting position
     */
    resetShipPosition() {
        this.playerSegment = 0;
        this.playerLane = 1; // Middle lane
        this.playerOffset = 0;
        
        // Position on the track
        const position = this.trackGenerator.getPositionOnTrack(this.playerSegment, this.playerLane);
        this.ship.position.copy(position);
        
        // Aim ship along the track
        const direction = this.trackGenerator.getDirectionAtSegment(this.playerSegment);
        this.ship.lookAt(this.ship.position.clone().add(direction));
    }

    /**
     * Start a new game
     */
    startGame() {
        if (!this.isInitialized || !this.audioProcessor.audioBuffer) {
            console.error("Cannot start game: Engine not initialized or no audio loaded");
            return false;
        }
        
        // Reset game state
        this.isPlaying = true;
        this.isPaused = false;
        this.isGameOver = false;
        this.playerSpeed = 1;
        this.targetSpeed = 1;
        this.playerSegment = 0;
        this.playerLane = 1;
        this.playerOffset = 0;
        this.lastFrameTime = this.clock.getElapsedTime();
        
        // Reset player position
        this.resetShipPosition();
        
        // Reset score
        this.scoreManager.resetScore();
        
        // Stop any previous playback and reset to beginning
        this.audioProcessor.stop();
        
        // Start audio playback
        this.audioProcessor.play();
        
        // Start the game loop
        this.gameLoop();
        
        return true;
    }

    /**
     * Pause the game
     */
    pauseGame() {
        if (!this.isPlaying || this.isGameOver) return;
        
        this.isPaused = true;
        this.audioProcessor.pause();
    }

    /**
     * Resume the game
     */
    resumeGame() {
        if (!this.isPlaying || this.isGameOver || !this.isPaused) return;
        
        this.isPaused = false;
        this.lastFrameTime = this.clock.getElapsedTime();
        this.audioProcessor.resume();
        this.gameLoop();
    }

    /**
     * End the current game
     */
    endGame() {
        this.isPlaying = false;
        this.isPaused = false;
        this.isGameOver = true;
        
        // Stop audio
        this.audioProcessor.stop();
        
        // Return final score
        return this.scoreManager.getScore();
    }

    /**
     * Main game loop
     */
    gameLoop() {
        if (!this.isPlaying || this.isPaused) return;
        
        // Calculate delta time
        const currentTime = this.clock.getElapsedTime();
        this.deltaTime = currentTime - this.lastFrameTime;
        this.lastFrameTime = currentTime;
        
        // Update game logic
        this.update();
        
        // Render the scene
        this.render();
        
        // Continue the loop
        requestAnimationFrame(() => this.gameLoop());
        
        // Check if track is complete
        const progress = this.audioProcessor.getPlaybackProgress();
        if (progress >= 0.999) {
            // Game complete
            this.handleGameComplete();
        }
    }

    /**
     * Update game logic
     */
    update() {
        // Update ship position and lane
        this.updateShipPosition();
        
        // Check for block collisions
        this.checkCollisions();
        
        // Update visible track segments
        this.trackGenerator.updateTrack(this.playerSegment);
        
        // Update camera position
        this.updateCamera();
        
        // Update audio analysis
        this.updateAudioEffects();
        
        // Update ship visuals
        this.updateShipVisuals();
        
        // Update shaders
        if (this.shaderManager) {
            this.shaderManager.update();
        }
    }

    /**
     * Render the scene
     */
    render() {
        if (this.usePostProcessing && this.composer) {
            this.composer.render();
        } else {
            this.renderer.render(this.scene, this.camera);
        }
    }

    /**
     * Update ship position based on player input and track
     */
    updateShipPosition() {
        // Adjust player speed
        this.playerSpeed = THREE.MathUtils.lerp(this.playerSpeed, this.targetSpeed, this.deltaTime * 2);
        
        // Move forward
        this.playerOffset += this.playerSpeed * this.deltaTime * this.gameSpeed;
        
        // If we've moved past the current segment, advance to next segment
        if (this.playerOffset >= 1) {
            this.playerOffset -= 1;
            this.playerSegment++;
            
            // Ensure we don't go beyond the track
            if (this.playerSegment >= this.trackGenerator.getTrackLength()) {
                this.playerSegment = this.trackGenerator.getTrackLength() - 1;
                this.playerOffset = 0.99;
            }
        }
        
        // Get position on the track
        const position = this.trackGenerator.getPositionOnTrack(this.playerSegment, this.playerLane, this.playerOffset);
        this.ship.position.copy(position);
        
        // Get forward direction
        const direction = this.trackGenerator.getDirectionAtSegment(this.playerSegment, this.playerOffset);
        
        // Calculate target rotation
        const targetRotation = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 0, 1),
            direction
        );
        
        // Smoothly rotate ship
        this.ship.quaternion.slerp(targetRotation, this.deltaTime * 5);
        
        // Bank ship for turns
        const bankAmount = this.inputHandler.horizontalInput * 0.3;
        this.shipModel.rotation.z = -bankAmount;
    }

    /**
     * Check for collisions with blocks
     */
    checkCollisions() {
        const collision = this.trackGenerator.checkBlockCollision(this.playerSegment, this.playerLane);
        
        if (collision) {
            // Get the color index of the collected block
            const colorIndex = CONFIG.visuals.blockColors.indexOf(collision.color);
            
            // Update score
            this.scoreManager.addBlock(colorIndex);
            
            // Visual feedback
            this.showCollectionEffect(collision.color);
            
            // Vibration feedback on mobile
            if (CONFIG.mobile.vibrationEnabled && 'vibrate' in navigator) {
                navigator.vibrate(50);
            }
        }
    }

    /**
     * Update camera position and orientation
     */
    updateCamera() {
        // Get player position and direction
        const playerPos = this.ship.position.clone();
        const playerDir = this.trackGenerator.getDirectionAtSegment(this.playerSegment, this.playerOffset);
        
        // Calculate camera position behind the ship
        const cameraOffset = playerDir.clone().multiplyScalar(-6).add(new THREE.Vector3(0, 2.5, 0));
        const targetCameraPos = playerPos.clone().add(cameraOffset);
        
        // Smoothly move the camera
        this.camera.position.lerp(targetCameraPos, this.deltaTime * 5);
        
        // Look ahead of the ship
        const lookAtPos = playerPos.clone().add(playerDir.clone().multiplyScalar(10));
        this.camera.lookAt(lookAtPos);
    }

    /**
     * Update audio-reactive effects
     */
    updateAudioEffects() {
        if (!this.audioProcessor.isAnalysisDone) return;
        
        // Get real-time audio analysis
        const analysis = this.audioProcessor.updateAnalysis();
        if (!analysis) return;
        
        // Update fog based on bass frequencies
        if (analysis.bandEnergies[0] > 0.7) {
            this.scene.fog.density = THREE.MathUtils.lerp(
                this.scene.fog.density,
                CONFIG.visuals.fogDensity * 0.7,
                this.deltaTime * 3
            );
        } else {
            this.scene.fog.density = THREE.MathUtils.lerp(
                this.scene.fog.density,
                CONFIG.visuals.fogDensity,
                this.deltaTime * 3
            );
        }
        
        // Update bloom intensity if post-processing is enabled
        if (this.usePostProcessing && this.bloomPass) {
            const beatIntensity = analysis.beatIntensity;
            this.bloomPass.strength = THREE.MathUtils.lerp(
                this.bloomPass.strength,
                CONFIG.visuals.bloomIntensity * (1 + beatIntensity * 0.5),
                this.deltaTime * 5
            );
        }
        
        // Adjust game speed based on intensity
        const targetGameSpeed = CONFIG.game.speed * (1 + analysis.beatIntensity * 0.2);
        this.gameSpeed = THREE.MathUtils.lerp(this.gameSpeed, targetGameSpeed, this.deltaTime * 2);
    }

    /**
     * Update ship visuals based on game state
     */
    updateShipVisuals() {
        // Pulse ship light based on music
        if (this.shipLight && this.audioProcessor.isAnalysisDone) {
            const analysis = this.audioProcessor.updateAnalysis();
            if (analysis) {
                const intensity = 1 + analysis.beatIntensity * 1.5;
                this.shipLight.intensity = intensity;
            }
        }
        
        // Update score display
        const uiController = window.uiController;
        if (uiController) {
            uiController.updateScore(this.scoreManager.getScore());
            uiController.updateMultiplier(this.scoreManager.getMultiplier());
            uiController.updateProgressBar(this.audioProcessor.getPlaybackProgress());
        }
    }

    /**
     * Show visual effect when collecting a block
     * @param {number} color - Color of the collected block
     */
    showCollectionEffect(color) {
        // Create a flash of light
        const flashLight = new THREE.PointLight(color, 2, 10);
        flashLight.position.copy(this.ship.position);
        this.scene.add(flashLight);
        
        // Animate and remove the light
        const startTime = this.clock.getElapsedTime();
        const animate = () => {
            const elapsed = this.clock.getElapsedTime() - startTime;
            if (elapsed < 0.3) {
                flashLight.intensity = 2 * (1 - elapsed / 0.3);
                requestAnimationFrame(animate);
            } else {
                this.scene.remove(flashLight);
            }
        };
        animate();
    }

    /**
     * Handle completion of the track
     */
    handleGameComplete() {
        this.isPlaying = false;
        this.isGameOver = true;
        
        // Calculate final score
        const finalScore = this.scoreManager.getFinalScore();
        
        // Trigger game over UI
        const uiController = window.uiController;
        if (uiController) {
            uiController.showResultsScreen(finalScore);
        }
    }

    /**
     * Move player to a different lane
     * @param {number} direction - Direction (-1 for left, 1 for right)
     */
    changeLane(direction) {
        const newLane = this.playerLane + direction;
        
        // Check lane bounds
        if (newLane >= 0 && newLane < this.trackGenerator.lanes) {
            this.playerLane = newLane;
        }
    }

    /**
     * Set target ship speed
     * @param {number} speed - Target speed (0-1)
     */
    setTargetSpeed(speed) {
        this.targetSpeed = THREE.MathUtils.clamp(speed, 0.5, 1.5);
    }

    /**
     * Load a track and generate the game level
     * @param {File} audioFile - The audio file to load
     * @returns {Promise} - Resolves when track is ready
     */
    loadTrack(audioFile) {
        return new Promise((resolve, reject) => {
            // Show loading screen
            if (window.uiController) {
                window.uiController.showLoadingScreen('Loading track...');
            }
            
            // First load the audio file
            this.audioProcessor.loadAudioFile(audioFile)
                .then(audioData => {
                    // Set up analysis callbacks
                    this.audioProcessor.setAnalysisProgressCallback(progress => {
                        const uiController = window.uiController;
                        if (uiController) {
                            uiController.updateLoadingProgress(progress);
                        }
                    });
                    
                    // Analyze the audio file
                    return this.audioProcessor.analyzeAudio();
                })
                .then(analysisResults => {
                    // Update loading message
                    if (window.uiController) {
                        window.uiController.showLoadingScreen('Generating track...');
                    }
                    
                    // Generate the track from analysis results
                    const trackInfo = this.trackGenerator.generateTrack(analysisResults);
                    
                    // Reset player and camera positions
                    this.resetShipPosition();
                    
                    // Hide loading screen
                    if (window.uiController) {
                        window.uiController.hideLoadingScreen();
                    }
                    
                    resolve({
                        trackInfo,
                        duration: this.audioProcessor.audioData.duration,
                        fileName: this.audioProcessor.audioData.fileName
                    });
                })
                .catch(error => {
                    if (window.uiController) {
                        window.uiController.hideLoadingScreen();
                    }
                    reject(error);
                });
        });
    }

    /**
     * Detect if running on a mobile device
     * @returns {boolean} - True if mobile device
     */
    isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
            || (window.innerWidth < 768);
    }

    /**
     * Dispose and clean up resources
     */
    dispose() {
        // Stop the game loop
        this.isPlaying = false;
        
        // Dispose audio processor
        if (this.audioProcessor) {
            this.audioProcessor.dispose();
        }
        
        // Clean up track
        if (this.trackGenerator) {
            this.trackGenerator.clearTrack();
        }
        
        // Clean up scene objects
        if (this.scene) {
            // Recursive function to dispose objects
            const disposeObject = (obj) => {
                if (obj.children) {
                    for (let i = obj.children.length - 1; i >= 0; i--) {
                        disposeObject(obj.children[i]);
                    }
                }
                
                if (obj.geometry) obj.geometry.dispose();
                
                if (obj.material) {
                    if (Array.isArray(obj.material)) {
                        for (let i = 0; i < obj.material.length; i++) {
                            obj.material[i].dispose();
                        }
                    } else {
                        obj.material.dispose();
                    }
                }
            };
            
            disposeObject(this.scene);
        }
        
        // Dispose renderer
        if (this.renderer) {
            this.renderer.dispose();
        }
        
        // Dispose composer
        if (this.composer) {
            this.composer.dispose();
        }
    }
}