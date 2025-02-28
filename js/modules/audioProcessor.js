/**
 * AudioProcessor - Handles audio file loading and analysis
 */
class AudioProcessor {
    constructor() {
        this.audioContext = null;
        this.audioBuffer = null;
        this.audioSource = null;
        this.analyzer = null;
        this.gainNode = null;
        this.audioData = {
            duration: 0,
            sampleRate: 0,
            fileName: "",
            isPlaying: false,
            startTime: 0,
            currentTime: 0,
        };
        this.frequencyData = null;
        this.timeData = null;
        this.analysisResults = [];
        this.isInitialized = false;
        this.analysisDone = false;
        this.onAnalysisProgressCallback = null;
        this.onAnalysisCompleteCallback = null;
    }

    /**
     * Initialize the audio context and analyzer
     */
    init() {
        try {
            // Create audio context
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();
            
            // Create analyzer node
            this.analyzer = this.audioContext.createAnalyser();
            this.analyzer.fftSize = CONFIG.audio.fftSize;
            this.analyzer.smoothingTimeConstant = CONFIG.audio.smoothingTimeConstant;
            this.analyzer.minDecibels = CONFIG.audio.minDecibels;
            this.analyzer.maxDecibels = CONFIG.audio.maxDecibels;
            
            // Create arrays for frequency and time domain data
            this.frequencyData = new Uint8Array(this.analyzer.frequencyBinCount);
            this.timeData = new Uint8Array(this.analyzer.frequencyBinCount);
            
            // Create gain node for volume control
            this.gainNode = this.audioContext.createGain();
            this.gainNode.gain.value = 1.0;
            
            // Connect nodes
            this.gainNode.connect(this.audioContext.destination);
            this.analyzer.connect(this.gainNode);
            
            this.isInitialized = true;
            return true;
        } catch (error) {
            console.error("Failed to initialize audio processor:", error);
            return false;
        }
    }

    /**
     * Load an audio file
     * @param {File} file - The audio file to load
     * @returns {Promise} - Resolves when audio is loaded
     */
    loadAudioFile(file) {
        return new Promise((resolve, reject) => {
            if (!this.isInitialized) {
                if (!this.init()) {
                    reject(new Error("Failed to initialize audio processor"));
                    return;
                }
            }

            const fileReader = new FileReader();
            
            fileReader.onload = async (event) => {
                try {
                    // Decode audio data
                    const arrayBuffer = event.target.result;
                    this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
                    
                    // Set audio data
                    this.audioData.duration = this.audioBuffer.duration;
                    this.audioData.sampleRate = this.audioBuffer.sampleRate;
                    this.audioData.fileName = file.name;
                    
                    // Reset analysis state
                    this.analysisDone = false;
                    this.analysisResults = [];
                    
                    resolve({
                        fileName: file.name,
                        duration: this.audioBuffer.duration,
                        sampleRate: this.audioBuffer.sampleRate
                    });
                } catch (error) {
                    reject(error);
                }
            };

            fileReader.onerror = (error) => {
                reject(error);
            };

            fileReader.readAsArrayBuffer(file);
        });
    }

    /**
     * Analyze the loaded audio file to prepare track generation
     * @param {number} resolution - Number of analysis points per second
     */
    analyzeAudio(resolution = 10) {
        return new Promise((resolve, reject) => {
            if (!this.audioBuffer) {
                reject(new Error("No audio buffer available for analysis"));
                return;
            }

            // Calculate total analysis points
            const totalDuration = this.audioBuffer.duration;
            const totalPoints = Math.floor(totalDuration * resolution);
            const interval = 1 / resolution;
            
            // Create an offline audio context for analysis
            const offlineContext = new OfflineAudioContext(
                this.audioBuffer.numberOfChannels,
                this.audioBuffer.length,
                this.audioBuffer.sampleRate
            );
            
            // Create source and analyzer for offline processing
            const offlineSource = offlineContext.createBufferSource();
            offlineSource.buffer = this.audioBuffer;
            
            const offlineAnalyzer = offlineContext.createAnalyser();
            offlineAnalyzer.fftSize = CONFIG.audio.fftSize;
            offlineAnalyzer.smoothingTimeConstant = CONFIG.audio.smoothingTimeConstant;
            offlineAnalyzer.minDecibels = CONFIG.audio.minDecibels;
            offlineAnalyzer.maxDecibels = CONFIG.audio.maxDecibels;
            
            // Connect nodes
            offlineSource.connect(offlineAnalyzer);
            offlineAnalyzer.connect(offlineContext.destination);
            
            // Arrays to store data
            this.analysisResults = [];
            let currentPoint = 0;
            
            // Start the source
            offlineSource.start(0);
            
            // Process audio in chunks
            const processChunk = async (currentTime) => {
                // If we've analyzed all points, finish
                if (currentPoint >= totalPoints) {
                    this.analysisDone = true;
                    if (this.onAnalysisCompleteCallback) {
                        this.onAnalysisCompleteCallback(this.analysisResults);
                    }
                    resolve(this.analysisResults);
                    return;
                }
                
                // Process next chunk
                const nextTime = Math.min(currentTime + interval, totalDuration);
                await offlineContext.suspend(nextTime);
                
                // Create arrays for frequency and time domain data
                const frequencyData = new Uint8Array(offlineAnalyzer.frequencyBinCount);
                const timeData = new Uint8Array(offlineAnalyzer.frequencyBinCount);
                
                // Get frequency and time domain data
                offlineAnalyzer.getByteFrequencyData(frequencyData);
                offlineAnalyzer.getByteTimeDomainData(timeData);
                
                // Calculate band energies
                const bandEnergies = this.calculateBandEnergies(frequencyData);
                
                // Calculate beat detection
                const beatIntensity = this.detectBeat(frequencyData, timeData);
                
                // Store analysis result
                this.analysisResults.push({
                    time: currentTime,
                    frequencyData: Array.from(frequencyData),  // Store a copy
                    timeData: Array.from(timeData),            // Store a copy
                    bandEnergies,
                    beatIntensity,
                    isBlock: beatIntensity > 0.6,  // Threshold for block generation
                    blockColor: this.determineBlockColor(bandEnergies),
                });
                
                // Call progress callback
                if (this.onAnalysisProgressCallback) {
                    this.onAnalysisProgressCallback(currentPoint / totalPoints);
                }
                
                // Move to next point
                currentPoint++;
                
                // Continue processing
                await offlineContext.resume();
                processChunk(nextTime);
            };
            
            // Start processing
            offlineContext.startRendering().then(() => {
                console.log("Audio analysis complete");
            }).catch(error => {
                reject(error);
            });
            
            // Begin processing the first chunk
            processChunk(0);
        });
    }

    /**
     * Calculate energy in each frequency band
     * @param {Uint8Array} frequencyData - Frequency domain data
     * @returns {Array} - Energy in each band
     */
    calculateBandEnergies(frequencyData) {
        const nyquist = this.audioContext.sampleRate / 2;
        const bands = CONFIG.audio.frequencyBands;
        const bandEnergies = [];

        for (const band of bands) {
            const minIndex = Math.floor(band.min / nyquist * frequencyData.length);
            const maxIndex = Math.floor(band.max / nyquist * frequencyData.length);
            let energy = 0;
            
            for (let i = minIndex; i <= maxIndex; i++) {
                energy += frequencyData[i] / 255;  // Normalize to 0-1
            }
            
            // Average energy in the band
            energy = energy / (maxIndex - minIndex + 1);
            bandEnergies.push(energy);
        }
        
        return bandEnergies;
    }

    /**
     * Simple beat detection algorithm
     * @param {Uint8Array} frequencyData - Frequency domain data
     * @param {Uint8Array} timeData - Time domain data
     * @returns {number} - Beat intensity (0-1)
     */
    detectBeat(frequencyData, timeData) {
        // Calculate energy in low frequency bands (bass)
        const nyquist = this.audioContext.sampleRate / 2;
        const lowFreqMax = 150;  // Focus on bass frequencies (up to 150Hz)
        const maxIndex = Math.floor(lowFreqMax / nyquist * frequencyData.length);
        
        let energy = 0;
        for (let i = 0; i < maxIndex; i++) {
            energy += frequencyData[i];
        }
        energy /= maxIndex * 255;  // Normalize to 0-1
        
        // Measure signal transients in time domain
        let transientEnergy = 0;
        for (let i = 1; i < timeData.length; i++) {
            // Calculate absolute difference between adjacent samples
            transientEnergy += Math.abs(timeData[i] - timeData[i - 1]);
        }
        transientEnergy /= 255 * timeData.length;  // Normalize to 0-1
        
        // Combine measures for beat detection
        const beatIntensity = Math.min(1, energy * 0.7 + transientEnergy * 0.3);
        return beatIntensity;
    }

    /**
     * Determine block color based on frequency bands
     * @param {Array} bandEnergies - Energy in each frequency band
     * @returns {number} - Color index
     */
    determineBlockColor(bandEnergies) {
        // Find the band with maximum energy
        let maxEnergyIndex = 0;
        let maxEnergy = 0;
        
        for (let i = 0; i < bandEnergies.length; i++) {
            if (bandEnergies[i] > maxEnergy) {
                maxEnergy = bandEnergies[i];
                maxEnergyIndex = i;
            }
        }
        
        // Map band index to color index
        return maxEnergyIndex % CONFIG.visuals.blockColors.length;
    }

    /**
     * Play the loaded audio
     */
    play() {
        if (!this.audioBuffer || this.audioData.isPlaying) return;
        
        // Create a new source node (can't reuse old ones)
        this.audioSource = this.audioContext.createBufferSource();
        this.audioSource.buffer = this.audioBuffer;
        this.audioSource.connect(this.analyzer);
        
        // Start playing
        this.audioSource.start(0);
        this.audioData.isPlaying = true;
        this.audioData.startTime = this.audioContext.currentTime;
    }

    /**
     * Pause the audio playback
     */
    pause() {
        if (!this.audioData.isPlaying || !this.audioSource) return;
        
        // Stop the audio source
        this.audioSource.stop();
        this.audioData.isPlaying = false;
        
        // Store current playback position
        this.audioData.currentTime = this.getCurrentTime();
    }

    /**
     * Resume audio playback from paused position
     */
    resume() {
        if (this.audioData.isPlaying) return;
        
        // Create a new source node
        this.audioSource = this.audioContext.createBufferSource();
        this.audioSource.buffer = this.audioBuffer;
        this.audioSource.connect(this.analyzer);
        
        // Start at the stored position
        this.audioSource.start(0, this.audioData.currentTime);
        
        this.audioData.isPlaying = true;
        this.audioData.startTime = this.audioContext.currentTime - this.audioData.currentTime;
    }

    /**
     * Stop audio playback and reset position
     */
    stop() {
        if (!this.audioData.isPlaying || !this.audioSource) return;
        
        // Stop the audio source
        this.audioSource.stop();
        this.audioData.isPlaying = false;
        this.audioData.currentTime = 0;
    }

    /**
     * Get current playback time
     * @returns {number} - Current time in seconds
     */
    getCurrentTime() {
        if (!this.audioData.isPlaying) {
            return this.audioData.currentTime;
        }
        
        return this.audioContext.currentTime - this.audioData.startTime;
    }

    /**
     * Get current audio playback progress (0-1)
     * @returns {number} - Playback progress
     */
    getPlaybackProgress() {
        if (!this.audioBuffer) return 0;
        return this.getCurrentTime() / this.audioBuffer.duration;
    }

    /**
     * Update audio analysis in real-time
     * @returns {Object} - Real-time analysis data
     */
    updateAnalysis() {
        if (!this.audioData.isPlaying) return null;
        
        // Get current frequency data
        this.analyzer.getByteFrequencyData(this.frequencyData);
        this.analyzer.getByteTimeDomainData(this.timeData);
        
        // Calculate band energies
        const bandEnergies = this.calculateBandEnergies(this.frequencyData);
        
        // Detect beat
        const beatIntensity = this.detectBeat(this.frequencyData, this.timeData);
        
        return {
            time: this.getCurrentTime(),
            frequencyData: Array.from(this.frequencyData),
            timeData: Array.from(this.timeData),
            bandEnergies,
            beatIntensity,
        };
    }

    /**
     * Set volume level
     * @param {number} volume - Volume level (0-1)
     */
    setVolume(volume) {
        if (this.gainNode) {
            this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
        }
    }

    /**
     * Set callback for analysis progress updates
     * @param {Function} callback - Progress callback function
     */
    setAnalysisProgressCallback(callback) {
        this.onAnalysisProgressCallback = callback;
    }

    /**
     * Set callback for analysis completion
     * @param {Function} callback - Completion callback function
     */
    setAnalysisCompleteCallback(callback) {
        this.onAnalysisCompleteCallback = callback;
    }

    /**
     * Clean up resources
     */
    dispose() {
        if (this.audioSource) {
            this.audioSource.stop();
            this.audioSource.disconnect();
        }
        
        if (this.analyzer) {
            this.analyzer.disconnect();
        }
        
        if (this.gainNode) {
            this.gainNode.disconnect();
        }
        
        this.audioBuffer = null;
        this.audioData.isPlaying = false;
    }
}

