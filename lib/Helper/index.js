'use strict';

module.exports.generateMetaData         = require('./generateMetaData.js');
module.exports.generateFrameByFrameData = require('./generateFrameByFrameData.js');
module.exports.generateExportList       = require('./generateExportList.js');
module.exports.groupSwfObjects          = require('./groupSwfObjects.js');
module.exports.getClasses               = require('./getClasses.js');
module.exports.getMains                 = require('./getMains.js');
module.exports.groupClasses             = require('./groupClasses.js');
module.exports.filterClasses            = require('./filterClasses.js');
module.exports.groupFiles               = require('./groupFiles.js');
module.exports.flattenAnimations        = require('./flattenAnimations.js');
module.exports.simplifyAnimation        = require('./simplifyAnimation.js');
module.exports.delocateMatrices         = require('./delocateMatrices.js');