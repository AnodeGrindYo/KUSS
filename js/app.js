/**
 * WebAudioSurf - Main application entry point
 */
(function() {
    // Initialize game components
    let gameEngine = null;
    let uiController = null;
    let inputHandler = null;
    let secretCode = '';
    let secretTimeout = null;
    
    // DOM elements
    const gameContainer = document.getElementById('game-container');
    const gameCanvas = document.getElementById('game-canvas');
    
    /**
     * Initialize the application
     */
    function init() {
        console.log('Initializing K.U.S.S Ultra Soundwave Surfer...');
        
        // Verify Three.js loaded correctly
        if (typeof THREE === 'undefined') {
            showError('Failed to load Three.js. Please check your internet connection and try again.');
            return;
        }
        
        // Create game engine
        gameEngine = new GameEngine();
        
        // Initialize game engine
        if (!gameEngine.init(gameContainer)) {
            showError('Failed to initialize game engine. Please try again or use a different browser.');
            return;
        }
        
        // Create UI controller
        uiController = new UIController(gameEngine);
        window.uiController = uiController; // Make accessible to game engine
        
        // Initialize input handler
        inputHandler = gameEngine.inputHandler;
        
        // Set up animation loop for input handling
        function updateInputLoop() {
            if (inputHandler) {
                inputHandler.update();
            }
            requestAnimationFrame(updateInputLoop);
        }
        updateInputLoop();
        
        // Set up window resize handler
        window.addEventListener('resize', handleResize);
        handleResize();
        
        // Add unload handler to clean up resources
        window.addEventListener('beforeunload', () => {
            if (gameEngine) {
                gameEngine.dispose();
            }
        });
        
        // Set up secret code handler
        document.addEventListener('keydown', handleSecretCode);
        
        console.log('WebAudioSurf initialized successfully');
    }
    
    /**
     * Handle window resize
     */
    function handleResize() {
        if (gameEngine && gameEngine.renderer) {
            const container = document.getElementById('game-container');
            gameEngine.handleResize(container);
        }
    }
    
    /**
     * Show error message
     * @param {string} message - Error message to display
     */
    function showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.style.position = 'absolute';
        errorDiv.style.top = '50%';
        errorDiv.style.left = '50%';
        errorDiv.style.transform = 'translate(-50%, -50%)';
        errorDiv.style.backgroundColor = 'rgba(50, 0, 0, 0.8)';
        errorDiv.style.color = 'white';
        errorDiv.style.padding = '20px';
        errorDiv.style.borderRadius = '10px';
        errorDiv.style.textAlign = 'center';
        errorDiv.style.maxWidth = '80%';
        errorDiv.style.zIndex = '1000';
        
        errorDiv.innerHTML = `
            <h3 style="margin-bottom: 10px; color: #ff5555;">Error</h3>
            <p>${message}</p>
        `;
        
        gameContainer.appendChild(errorDiv);
    }
    
    /**
     * Handle secret code input
     * @param {KeyboardEvent} event - Keyboard event
     */
    function handleSecretCode(event) {
        // Clear timeout if it exists
        if (secretTimeout) {
            clearTimeout(secretTimeout);
        }
        
        // Add key to secret code
        secretCode += event.key.toLowerCase();
        
        // Check if secret code matches
        if (secretCode.includes('kuss')) {
            secretCode = '';
            generateCodePenExport();
        }
        
        // Set timeout to clear code after 2 seconds of inactivity
        secretTimeout = setTimeout(() => {
            secretCode = '';
        }, 2000);
    }
    
    /**
     * Bundle all CSS files
     * @returns {string} - Bundled CSS
     */
    function bundleCss() {
        let css = '';
        
        // Get all stylesheets
        const stylesheets = document.querySelectorAll('link[rel="stylesheet"]');
        
        // Loop through each stylesheet to get its content
        for (const stylesheet of stylesheets) {
            try {
                const href = stylesheet.getAttribute('href');
                // Skip CDN resources
                if (href.includes('//') || href.includes('cdn')) continue;
                
                const xhr = new XMLHttpRequest();
                xhr.open('GET', href, false); // Synchronous request
                xhr.send();
                if (xhr.status === 200) {
                    css += `/* ${href.split('/').pop()} */\n${xhr.responseText}\n\n`;
                }
            } catch (error) {
                console.error(`Error processing stylesheet:`, error);
            }
        }
        
        // If no CSS was found, add a default style
        if (css.trim() === '') {
            css = `/* Reset CSS */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

html, body {
    width: 100%;
    height: 100%;
    overflow: hidden;
    font-family: Arial, Helvetica, sans-serif;
    background-color: #0a0a1a;
    color: #ffffff;
}

/* Main game styles would go here */
.screen {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: none;
}

.screen.active {
    display: flex;
}`;
        }
        
        return css;
    }

    /**
     * Bundle all JS files
     * @returns {string} - Bundled JS
     */
    function bundleJs() {
        let js = '';
        
        // Add config
        js += `// Game configuration\nconst CONFIG = ${JSON.stringify(CONFIG, null, 2)};\n\n`;
        
        // Get all script tags
        const scripts = document.querySelectorAll('script');
        
        // Loop through each script to get its content
        for (const script of scripts) {
            // Skip inline scripts, empty src, or CDN sources
            if (!script.src || script.src.includes('cdn') || script.src.includes('//')) continue;
            
            try {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', script.src, false); // Synchronous request
                xhr.send();
                if (xhr.status === 200) {
                    js += `/* ${script.src.split('/').pop()} */\n${xhr.responseText}\n\n`;
                }
            } catch (error) {
                console.error(`Error processing script:`, error);
            }
        }
        
        // If no JS was found, add a placeholder
        if (js.trim() === '') {
            js = `// Main application code would go here
document.addEventListener('DOMContentLoaded', function() {
  console.log('K.U.S.S Ultra Soundwave Surfer initialized');
});`;
        }
        
        return js;
    }

    /**
     * Bundle all HTML files
     * @returns {string} - Bundled HTML
     */
    function bundleHtml() {
        // Create a copy of the document to modify
        const docClone = document.cloneNode(true);
        
        // Remove script tags that point to external files
        const scripts = docClone.querySelectorAll('script[src]');
        scripts.forEach(script => script.remove());
        
        // Remove stylesheet links
        const styleLinks = docClone.querySelectorAll('link[rel="stylesheet"]');
        styleLinks.forEach(link => link.remove());
        
        // Add placeholder script and style tags
        const head = docClone.querySelector('head');
        
        // Add style tag
        const styleTag = docClone.createElement('style');
        styleTag.textContent = '/* CSS will be in separate file */';
        head.appendChild(styleTag);
        
        // Add script tag at the end of body
        const body = docClone.querySelector('body');
        const scriptTag = docClone.createElement('script');
        scriptTag.textContent = '/* JS will be in separate file */';
        body.appendChild(scriptTag);
        
        return docClone.documentElement.outerHTML;
    }

    /**
     * Download a file
     * @param {string} filename - File name
     * @param {string} content - File content
     */
    function downloadFile(filename, content) {
        const blob = new Blob([content], {type: 'text/plain'});
        const url = URL.createObjectURL(blob);
        const element = document.createElement('a');
        element.setAttribute('href', url);
        element.setAttribute('download', filename);
        element.style.display = 'none';
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
        URL.revokeObjectURL(url);
    }
    
    /**
     * Show a message to the user
     * @param {string} message - Message to display
     */
    function showMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.style.position = 'fixed';
        messageDiv.style.top = '20px';
        messageDiv.style.left = '50%';
        messageDiv.style.transform = 'translateX(-50%)';
        messageDiv.style.backgroundColor = 'rgba(0, 170, 255, 0.9)';
        messageDiv.style.color = 'white';
        messageDiv.style.padding = '15px 30px';
        messageDiv.style.borderRadius = '5px';
        messageDiv.style.zIndex = '10000';
        messageDiv.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.5)';
        messageDiv.textContent = message;
        
        document.body.appendChild(messageDiv);
        
        // Remove after 3 seconds
        setTimeout(() => {
            document.body.removeChild(messageDiv);
        }, 3000);
    }
    
    // Create CodePen export and download links
    function generateCodePenExport() {
        console.log('Generating CodePen export...');
        
        try {
            // Create bundled files
            const html = bundleHtml();
            const css = bundleCss();
            const js = bundleJs();
            
            console.log('HTML size:', html.length);
            console.log('CSS size:', css.length);
            console.log('JS size:', js.length);
            
            // Create download links for each file
            if (html.length > 0) downloadFile('kuss-html.html', html);
            if (css.length > 0) downloadFile('kuss-css.css', css);
            if (js.length > 0) downloadFile('kuss-js.js', js);
            
            // Create feedback message
            showMessage('CodePen export ready! Check your downloads.');
        } catch (error) {
            console.error('Error generating CodePen export:', error);
            showMessage('Failed to generate CodePen export: ' + error.message);
        }
    }
    
    // Initialize the application when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();