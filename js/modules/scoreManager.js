/**
 * ScoreManager - Manages scoring and combo system
 */
class ScoreManager {
    constructor() {
        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.currentMultiplier = 1.0;
        this.consecutiveBlocks = 0;
        this.comboTimer = null;
        this.lastBlockColor = -1;
        this.colorMatches = 0;
        this.blockCollected = 0;
        this.perfect = 0;
    }

    /**
     * Reset score and combo
     */
    resetScore() {
        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.currentMultiplier = 1.0;
        this.consecutiveBlocks = 0;
        this.lastBlockColor = -1;
        this.colorMatches = 0;
        this.blockCollected = 0;
        this.perfect = 0;
        
        if (this.comboTimer) {
            clearTimeout(this.comboTimer);
            this.comboTimer = null;
        }
    }

    /**
     * Add points for collecting a block
     * @param {number} blockColor - Color index of the collected block
     */
    addBlock(blockColor) {
        // Clear existing combo timer
        if (this.comboTimer) {
            clearTimeout(this.comboTimer);
        }
        
        // Increment block counter
        this.blockCollected++;
        
        // Calculate points
        let points = CONFIG.scoring.basePoints;
        
        // Apply multiplier
        points *= this.currentMultiplier;
        
        // Handle color matching
        if (this.lastBlockColor === blockColor) {
            // Color match bonus
            this.colorMatches++;
            points += CONFIG.scoring.colorMatch * this.colorMatches;
            
            // Perfect match after 3 consecutive same colors
            if (this.colorMatches >= 3) {
                points += CONFIG.scoring.perfectMatch;
                this.perfect++;
            }
        } else {
            // Reset color matches
            this.colorMatches = 0;
        }
        
        // Update last block color
        this.lastBlockColor = blockColor;
        
        // Increment combo
        this.combo++;
        this.consecutiveBlocks++;
        
        // Update max combo
        if (this.combo > this.maxCombo) {
            this.maxCombo = this.combo;
        }
        
        // Update multiplier (capped at max)
        this.currentMultiplier = Math.min(
            1.0 + (this.combo * CONFIG.scoring.comboMultiplier),
            CONFIG.scoring.maxCombo
        );
        
        // Add points to score
        this.score += Math.round(points);
        
        // Set combo timer
        this.comboTimer = setTimeout(() => {
            this.resetCombo();
        }, 2000); // Reset combo after 2 seconds of inactivity
    }

    /**
     * Add penalty for missing a block
     */
    addMiss() {
        // Apply miss penalty
        this.score += CONFIG.scoring.miss;
        
        // Ensure score doesn't go below 0
        if (this.score < 0) {
            this.score = 0;
        }
        
        // Reset combo
        this.resetCombo();
    }

    /**
     * Reset combo but keep score
     */
    resetCombo() {
        this.combo = 0;
        this.currentMultiplier = 1.0;
        this.colorMatches = 0;
    }

    /**
     * Get current score
     * @returns {number} - Current score
     */
    getScore() {
        return this.score;
    }

    /**
     * Get current multiplier
     * @returns {number} - Current multiplier
     */
    getMultiplier() {
        return this.currentMultiplier;
    }

    /**
     * Get max combo achieved
     * @returns {number} - Max combo
     */
    getMaxCombo() {
        return this.maxCombo;
    }

    /**
     * Calculate final score with bonuses
     * @returns {number} - Final score with bonuses
     */
    getFinalScore() {
        // Base score
        let finalScore = this.score;
        
        // Add max combo bonus
        const comboBonus = this.maxCombo * 50;
        finalScore += comboBonus;
        
        // Add perfect match bonus
        const perfectBonus = this.perfect * 200;
        finalScore += perfectBonus;
        
        return Math.round(finalScore);
    }

    /**
     * Get statistics for end-game display
     * @returns {Object} - Score statistics
     */
    getScoreStats() {
        return {
            score: this.score,
            maxCombo: this.maxCombo,
            blocksCollected: this.blockCollected,
            perfectMatches: this.perfect,
            finalScore: this.getFinalScore()
        };
    }
}

