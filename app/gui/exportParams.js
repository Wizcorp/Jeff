module.exports = {
	// Primary options
	source:             '',       // {string}  Source of the file(s) to export. Can be defined as a regular expression
	inputDir:           '',       // {string}  Input directory, directory must exist.
	outDir:             '',       // {string}  Output directory

	// GUI specific
	outBasePath:        '',       // {string}  Output directory base path (in case user ask to create a new directory for export)
	createNewDir:       false,    // {boolean} Should we create a new directory for the output

	// Secondary options
	scope:              'main',   // {string}  Scope of the animation to export, either "classes" or "main"
	ratio:              1,        // {number}  Image scale
	renderFrames:       false,    // {boolean} To extract specified frames of the animations as PNGs

	// Optimisation options
	imageOptim:         false,    // {boolean} To apply a lossless image compression
	imageQuality:       100,      // {number}  Image quality. From 0 to 100
	createAtlas:        true,     // {boolean} To extract all the images of an animation into a single atlas
	powerOf2Images:     false,    // {boolean} To set the dimensions of output images to powers of 2
	maxImageDim:        2048,     // {number}  Maximum image dimension
	simplify:           false,    // {boolean} To simplify animations (reduce number of symbols)
	beautify:           false,    // {boolean} To beautify JSON output
	flatten:            false,    // {boolean} To extract a flat animation structure rather than a hierarchical structure
	compressMatrices:   false,    // {boolean} To extract animations with matrices under a compressed format

	// Advanced options
	splitClasses:       false,    // {boolean} To split the different classes of the animation into several outputs
	exportAtRoot:       false,    // {boolean} To export everything at the root of the output directory
	ignoreData:         false,    // {boolean} Not to export JSON meta-data
	ignoreImages:       false,    // {boolean} Not to export images
	filtering:          'linear', // {string}  Filtering that should be used when rendering the animation
	outlineEmphasis:    1         // {number}  Emphasis of outlines when rendering Flash vectorial drawings
};