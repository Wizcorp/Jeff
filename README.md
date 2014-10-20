# jeff

Extract JSON meta-data and images from a SWF file

## Install

`npm install jeff`

## Use

`jeff -src mySwf.swf`

### Operation

1 - Will parse the input directory to find SWF files corresponding to the given source file pattern.
2 - Will sequentially parse and process the SWF files.
3 - Will export JSON meta-data and images corresponding to the SWF files.

## TODO

* Export SWF texts
* Export SWF scale-grids
* Export SWF buttons
* Export SWF actionscript
* Add vectorial shapes export option
* Add key-frame based meta-data export option