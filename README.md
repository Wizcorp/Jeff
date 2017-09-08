# jeff

Jeff converts Flash™ SWFs into a JSON/PNG format for high performance usage in HTML/Javascript.
The extracted content could be used to integrate Flash™ Animations in your game using your favorite HTML Game Engine.

Contains a variety of options to allow you to get performance where you need it:

Optimised speed performance:
	- Asset rasterisation (faster than vectorial drawing)
	- Image Atlas creation (to enable batch sprite rendering in WebGL)
	- Extracting images with power of 2 dimensions (to enable mipmapping)

Optimised memory performance:
	- Image compression (lossy and loss-less compressions)
	- Animation Scaling (to rasterise images at the exact size needed)

Optimised ease of use:
	- Gathering several animations in a single output: Reduced number of assets to manage
	- Frame by Frame rasterisation: for easy integration in your game

Very good scalability: usable in command line or through the API it can be used to do batch extraction on multiple SWFs.

Made in [Wizcorp](http://www.wizcorp.jp).

## Install
Go into JEFF directory and do:

```
> npm install electron -g
> npm install
```

## Use
Go into JEFF directory and do:
	`electron . -s mySwf.swf -o outputPath`

You can see all available options [here](https://github.com/Wizcorp/Jeff/blob/electron/bin/jeff).

You can also launch it with a user interface with: `electron .`

## Roadmap for unsupported features
* Texts (Static/Dynamic)
* Buttons
* Embedded fonts
* Sounds
* ActionScript

## Roadmap for extract options
* Option to extract shapes under vectorial format
* Option to extract meta-data under keyframe based format (as opposed to per frame transformation matrix)

For contributors, see [Swf File Format Specifications](http://wwwimages.adobe.com/www.adobe.com/content/dam/Adobe/en/devnet/swf/pdf/swf-file-format-spec.pdf)

## Remarks
Unlike the master branch, generated images are not compressed.
