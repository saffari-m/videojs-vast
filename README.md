# videojs-vast

A Video.js plugin to allow the player to sarve adverts using VAST

## Table of Contents

<!-- START doctoc -->
<!-- END doctoc -->
## Installation

```sh
npm install --save @filmgardi/videojs-vast
```

## Usage

To include videojs-vast on your website or web application, use any of the following methods.

### `<script>` Tag

This is the simplest case. Get the script in whatever way you prefer and include the plugin _after_ you include [video.js][videojs], so that the `videojs` global is available.

```html
<script src="//path/to/video.min.js"></script>
<script src="//path/to/videojs-vast.min.js"></script>
<script>
  var player = videojs('my-video');

  player.vast();
</script>
```

### Browserify/CommonJS

When using with Browserify, install videojs-vast via npm and `require` the plugin as you would any other module.

```js
var videojs = require('video.js');

// The actual plugin function is exported by this module, but it is also
// attached to the `Player.prototype`; so, there is no need to assign it
// to a variable.
require('@filmgardi/videojs-vast');

var player = videojs('my-video');

player.vast();
```

### RequireJS/AMD

When using with RequireJS (or another AMD library), get the script in whatever way you prefer and `require` the plugin as you normally would:

```js
require(['video.js', '@filmgardi/videojs-vast'], function(videojs) {
  var player = videojs('my-video');

  player.vast();
});
```

## License

MIT. Copyright (c) mohamadsaffari90@gmail.com &lt;mohamadsaffari90@gmail.com&gt;


[videojs]: http://videojs.com/
