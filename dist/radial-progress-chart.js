(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.RadialProgressChart = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var d3;

// RadialProgressChart object
function RadialProgressChart(query, options) {

  // verify d3 is loaded
  d3 = (typeof window !== 'undefined' && window.d3) ? window.d3 : typeof require !== 'undefined' ? require("d3") : undefined;
  if(!d3) throw new Error('d3 object is missing. D3.js library has to be loaded before.');

  var self = this;
  self.options = RadialProgressChart.normalizeOptions(options);

  // internal  variables
  var series = self.options.series
    , width = 15 + ((self.options.diameter / 2) + (self.options.stroke.width * self.options.series.length) + (self.options.stroke.gap * self.options.series.length - 1)) * 2
    , height = width
    , dim = "0 0 " + height + " " + width
    , τ = 2 * Math.PI
    , inner = []
    , outer = [];

  function innerRadius(item) {
    var radius = inner[item.index];
    if (radius) return radius;

    // first ring based on diameter and the rest based on the previous outer radius plus gap
    radius = item.index === 0 ? self.options.diameter / 2 : outer[item.index - 1] + self.options.stroke.gap;
    inner[item.index] = radius;
    return radius;
  }

  function outerRadius(item) {
    var radius = outer[item.index];
    if (radius) return radius;

    // based on the previous inner radius + stroke width
    radius = inner[item.index] + self.options.stroke.width;
    outer[item.index] = radius;
    return radius;
  }

  self.progress = d3.arc()
    .startAngle(0)
    .endAngle(function (item) {
      return item.percentage / 100 * τ;
    })
    .innerRadius(innerRadius)
    .outerRadius(outerRadius)
    .cornerRadius(function (d) {
      // Workaround for d3 bug https://github.com/mbostock/d3/issues/2249
      // Reduce corner radius when corners are close each other
      var m = d.percentage >= 90 ? (100 - d.percentage) * 0.1 : 1;
      return (self.options.stroke.width / 2) * m;
    });

  var background = d3.arc()
    .startAngle(0)
    .endAngle(τ)
    .innerRadius(innerRadius)
    .outerRadius(outerRadius);

  // create svg
  self.svg = d3.select(query).append("svg")
    .attr("preserveAspectRatio","xMinYMin meet")
    .attr("viewBox", dim)
    .append("g")
    .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

  // add gradients defs
  var defs = self.svg.append("svg:defs");
  series.forEach(function (item) {
    if (item.color.linearGradient || item.color.radialGradient) {
      var gradient = RadialProgressChart.Gradient.toSVGElement('gradient' + item.index, item.color);
      defs.node().appendChild(gradient);
    }
  });

  // add shadows defs
  defs = self.svg.append("svg:defs");
  var dropshadowId = "dropshadow-" + Math.random();
  var filter = defs.append("filter").attr("id", dropshadowId);
  if(self.options.shadow.width > 0) {
    
    filter.append("feGaussianBlur")
      .attr("in", "SourceAlpha")
      .attr("stdDeviation", self.options.shadow.width)
      .attr("result", "blur");

    filter.append("feOffset")
      .attr("in", "blur")
      .attr("dx", 1)
      .attr("dy", 1)
      .attr("result", "offsetBlur");
  }

  var feMerge = filter.append("feMerge");
  feMerge.append("feMergeNode").attr("in", "offsetBlur");
  feMerge.append("feMergeNode").attr("in", "SourceGraphic");

  // add inner text
  if (self.options.center) {
    self.svg.append("text")
      .attr('class', 'rbc-center-text')
      .attr("text-anchor", "middle")
      .attr('x', self.options.center.x + 'px')
      .attr('y', self.options.center.y + 'px')
      .selectAll('tspan')
      .data(self.options.center.content).enter()
      .append('tspan')
      .attr("dominant-baseline", function () {

        // Single lines can easily centered in the middle using dominant-baseline, multiline need to use y
        if (self.options.center.content.length === 1) {
          return 'central';
        }
      })
      .attr('class', function (d, i) {
        return 'rbc-center-text-line' + i;
      })
      .attr('x', 0)
      .attr('dy', function (d, i) {
        if (i > 0) {
          return '1.1em';
        }
      })
      .each(function (d) {
        if (typeof d === 'function') {
          this.callback = d;
        }
      })
      .text(function (d) {
        if (typeof d === 'string') {
          return d;
        }

        return '';
      });
  }

  // add ring structure
  self.field = self.svg.selectAll("g")
    .data(series)
    .enter().append("g");

  self.field.append("path").attr("class", "progress").attr("filter", "url(#" + dropshadowId +")");

  self.field.append("path").attr("class", "bg")
    .style("fill", function (item) {
      return item.color.background;
    })
    .style("opacity", 0.2)
    .attr("d", background);

  self.field.append("text")
    .classed('rbc-label rbc-label-start', true)
    .attr("dominant-baseline", "central")
    .attr("x", "10")
    .attr("y", function (item) {
      return -(
        self.options.diameter / 2 +
        item.index * (self.options.stroke.gap + self.options.stroke.width) +
        self.options.stroke.width / 2
        );
    })
    .text(function (item) {
      return item.labelStart;
    });

  self.update();
}

/**
 * Update data to be visualized in the chart.
 *
 * @param {Object|Array} data Optional data you'd like to set for the chart before it will update. If not specified the update method will use the data that is already configured with the chart.
 * @example update([70, 10, 45])
 * @example update({series: [{value: 70}, 10, 45]})
 *
 */
RadialProgressChart.prototype.update = function (data) {
  var self = this;

  // parse new data
  if (data) {
    if (typeof data === 'number') {
      data = [data];
    }

    var series;

    if (Array.isArray(data)) {
      series = data;
    } else if (typeof data === 'object') {
      series = data.series || [];
    }

    for (var i = 0; i < series.length; i++) {
      this.options.series[i].previousValue = this.options.series[i].value;

      var item = series[i];
      if (typeof item === 'number') {
        this.options.series[i].value = item;
      } else if (typeof item === 'object') {
        this.options.series[i].value = item.value;
      }
    }
  }

  // calculate from percentage and new percentage for the progress animation
  self.options.series.forEach(function (item) {
    item.fromPercentage = item.percentage ? item.percentage : 5;
    item.percentage = (item.value - self.options.min) * 100 / (self.options.max - self.options.min);
  });

  var center = self.svg.select("text.rbc-center-text");

  // progress
  self.field.select("path.progress")
    .interrupt()
    .transition()
    .duration(self.options.animation.duration)
    .delay(function (d, i) {
      // delay between each item
      return i * self.options.animation.delay;
    })
    .ease(d3.easeElastic)
    .attrTween("d", function (item) {
      var interpolator = d3.interpolateNumber(item.fromPercentage, item.percentage);
      return function (t) {
        item.percentage = interpolator(t);
        return self.progress(item);
      };
    })
    .tween("center", function (item) {
      // Execute callbacks on each line
      if (self.options.center) {
        var interpolate = self.options.round ? d3.interpolateRound : d3.interpolateNumber;
        var interpolator = interpolate(item.previousValue || 0, item.value);
        return function (t) {
          center
            .selectAll('tspan')
            .each(function () {
              if (this.callback) {
                d3.select(this).text(this.callback(interpolator(t), item.index, item));
              }
            });
        };
      }
    })
    .tween("interpolate-color", function (item) {
      if (item.color.interpolate && item.color.interpolate.length == 2) {
        var colorInterpolator = d3.interpolateHsl(item.color.interpolate[0], item.color.interpolate[1]);

        return function (t) {
          var color = colorInterpolator(item.percentage / 100);
          d3.select(this).style('fill', color);
          d3.select(this.parentNode).select('path.bg').style('fill', color);
        };
      }
    })
    .style("fill", function (item) {
      if (item.color.solid) {
        return item.color.solid;
      }

      if (item.color.linearGradient || item.color.radialGradient) {
        return "url(#gradient" + item.index + ')';
      }
    });
};

/**
 * Remove svg and clean some references
 */
RadialProgressChart.prototype.destroy = function () {
  this.svg.remove();
  delete this.svg;
};

/**
 * Detach and normalize user's options input.
 */
RadialProgressChart.normalizeOptions = function (options) {
  if (!options || typeof options !== 'object') {
    options = {};
  }

  var _options = {
    diameter: options.diameter || 100,
    stroke: {
      width: options.stroke && options.stroke.width || 40,
      gap: (!options.stroke || options.stroke.gap === undefined) ? 2 : options.stroke.gap
    },
    shadow: {
      width: (!options.shadow || options.shadow.width === null) ? 4 : options.shadow.width
    },
    animation: {
      duration: options.animation && options.animation.duration || 1750,
      delay: options.animation && options.animation.delay || 200
    },
    min: options.min || 0,
    max: options.max || 100,
    round: options.round !== undefined ? !!options.round : true,
    series: options.series || [],
    center: RadialProgressChart.normalizeCenter(options.center)
  };

  var defaultColorsIterator = new RadialProgressChart.ColorsIterator();
  for (var i = 0, length = _options.series.length; i < length; i++) {
    var item = options.series[i];

    // convert number to object
    if (typeof item === 'number') {
      item = {value: item};
    }

    _options.series[i] = {
      index: i,
      value: item.value,
      labelStart: item.labelStart,
      color: RadialProgressChart.normalizeColor(item.color, defaultColorsIterator)
    };
  }

  return _options;
};

/**
 * Normalize different notations of color property
 *
 * @param {String|Array|Object} color
 * @example '#fe08b5'
 * @example { solid: '#fe08b5', background: '#000000' }
 * @example ['#000000', '#ff0000']
 * @example {
                linearGradient: { x1: '0%', y1: '100%', x2: '50%', y2: '0%'},
                stops: [
                  {offset: '0%', 'stop-color': '#fe08b5', 'stop-opacity': 1},
                  {offset: '100%', 'stop-color': '#ff1410', 'stop-opacity': 1}
                ]
              }
 * @example {
                radialGradient: {cx: '60', cy: '60', r: '50'},
                stops: [
                  {offset: '0%', 'stop-color': '#fe08b5', 'stop-opacity': 1},
                  {offset: '100%', 'stop-color': '#ff1410', 'stop-opacity': 1}
                ]
              }
 *
 */
RadialProgressChart.normalizeColor = function (color, defaultColorsIterator) {

  if (!color) {
    color = {solid: defaultColorsIterator.next()};
  } else if (typeof color === 'string') {
    color = {solid: color};
  } else if (Array.isArray(color)) {
    color = {interpolate: color};
  } else if (typeof color === 'object') {
    if (!color.solid && !color.interpolate && !color.linearGradient && !color.radialGradient) {
      color.solid = defaultColorsIterator.next();
    }
  }

  // Validate interpolate syntax
  if (color.interpolate) {
    if (color.interpolate.length !== 2) {
      throw new Error('interpolate array should contain two colors');
    }
  }

  // Validate gradient syntax
  if (color.linearGradient || color.radialGradient) {
    if (!color.stops || !Array.isArray(color.stops) || color.stops.length !== 2) {
      throw new Error('gradient syntax is malformed');
    }
  }

  // Set background when is not provided
  if (!color.background) {
    if (color.solid) {
      color.background = color.solid;
    } else if (color.interpolate) {
      color.background = color.interpolate[0];
    } else if (color.linearGradient || color.radialGradient) {
      color.background = color.stops[0]['stop-color'];
    }
  }

  return color;

};


/**
 * Normalize different notations of center property
 *
 * @param {String|Array|Function|Object} center
 * @example 'foo bar'
 * @example { content: 'foo bar', x: 10, y: 4 }
 * @example function(value, index, item) {}
 * @example ['foo bar', function(value, index, item) {}]
 */
RadialProgressChart.normalizeCenter = function (center) {
  if (!center) return null;

  // Convert to object notation
  if (center.constructor !== Object) {
    center = {content: center};
  }

  // Defaults
  center.content = center.content || [];
  center.x = center.x || 0;
  center.y = center.y || 0;

  // Convert content to array notation
  if (!Array.isArray(center.content)) {
    center.content = [center.content];
  }

  return center;
};

// Linear or Radial Gradient internal object
RadialProgressChart.Gradient = (function () {
  function Gradient() {
  }

  Gradient.toSVGElement = function (id, options) {
    var gradientType = options.linearGradient ? 'linearGradient' : 'radialGradient';
    var gradient = d3.select(document.createElementNS("//www.w3.org/2000/svg", gradientType)).attr('id', id);

    Object.keys(options[gradientType]).forEach(key => {
      gradient.attr(key, options[gradientType][key]);
    });

    options.stops.forEach(function (stopAttrs) {
      const stop = gradient.append("svg:stop");

      Object.keys(stopAttrs).forEach(key => {
        stop.attr(key, stopAttrs[key]);
      });
    });

    this.background = options.stops[0]['stop-color'];

    return gradient.node();
  };

  return Gradient;
})();

// Default colors iterator
RadialProgressChart.ColorsIterator = (function () {

  ColorsIterator.DEFAULT_COLORS = ["#1ad5de", "#a0ff03", "#e90b3a", '#ff9500', '#007aff', '#ffcc00', '#5856d6', '#8e8e93'];

  function ColorsIterator() {
    this.index = 0;
  }

  ColorsIterator.prototype.next = function () {
    if (this.index === ColorsIterator.DEFAULT_COLORS.length) {
      this.index = 0;
    }

    return ColorsIterator.DEFAULT_COLORS[this.index++];
  };

  return ColorsIterator;
})();


// Export RadialProgressChart object
if (typeof module !== "undefined")module.exports = RadialProgressChart;
},{"d3":undefined}]},{},[1])(1)
});

//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIid1c2Ugc3RyaWN0JztcblxudmFyIGQzO1xuXG4vLyBSYWRpYWxQcm9ncmVzc0NoYXJ0IG9iamVjdFxuZnVuY3Rpb24gUmFkaWFsUHJvZ3Jlc3NDaGFydChxdWVyeSwgb3B0aW9ucykge1xuXG4gIC8vIHZlcmlmeSBkMyBpcyBsb2FkZWRcbiAgZDMgPSAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgJiYgd2luZG93LmQzKSA/IHdpbmRvdy5kMyA6IHR5cGVvZiByZXF1aXJlICE9PSAndW5kZWZpbmVkJyA/IHJlcXVpcmUoXCJkM1wiKSA6IHVuZGVmaW5lZDtcbiAgaWYoIWQzKSB0aHJvdyBuZXcgRXJyb3IoJ2QzIG9iamVjdCBpcyBtaXNzaW5nLiBEMy5qcyBsaWJyYXJ5IGhhcyB0byBiZSBsb2FkZWQgYmVmb3JlLicpO1xuXG4gIHZhciBzZWxmID0gdGhpcztcbiAgc2VsZi5vcHRpb25zID0gUmFkaWFsUHJvZ3Jlc3NDaGFydC5ub3JtYWxpemVPcHRpb25zKG9wdGlvbnMpO1xuXG4gIC8vIGludGVybmFsICB2YXJpYWJsZXNcbiAgdmFyIHNlcmllcyA9IHNlbGYub3B0aW9ucy5zZXJpZXNcbiAgICAsIHdpZHRoID0gMTUgKyAoKHNlbGYub3B0aW9ucy5kaWFtZXRlciAvIDIpICsgKHNlbGYub3B0aW9ucy5zdHJva2Uud2lkdGggKiBzZWxmLm9wdGlvbnMuc2VyaWVzLmxlbmd0aCkgKyAoc2VsZi5vcHRpb25zLnN0cm9rZS5nYXAgKiBzZWxmLm9wdGlvbnMuc2VyaWVzLmxlbmd0aCAtIDEpKSAqIDJcbiAgICAsIGhlaWdodCA9IHdpZHRoXG4gICAgLCBkaW0gPSBcIjAgMCBcIiArIGhlaWdodCArIFwiIFwiICsgd2lkdGhcbiAgICAsIM+EID0gMiAqIE1hdGguUElcbiAgICAsIGlubmVyID0gW11cbiAgICAsIG91dGVyID0gW107XG5cbiAgZnVuY3Rpb24gaW5uZXJSYWRpdXMoaXRlbSkge1xuICAgIHZhciByYWRpdXMgPSBpbm5lcltpdGVtLmluZGV4XTtcbiAgICBpZiAocmFkaXVzKSByZXR1cm4gcmFkaXVzO1xuXG4gICAgLy8gZmlyc3QgcmluZyBiYXNlZCBvbiBkaWFtZXRlciBhbmQgdGhlIHJlc3QgYmFzZWQgb24gdGhlIHByZXZpb3VzIG91dGVyIHJhZGl1cyBwbHVzIGdhcFxuICAgIHJhZGl1cyA9IGl0ZW0uaW5kZXggPT09IDAgPyBzZWxmLm9wdGlvbnMuZGlhbWV0ZXIgLyAyIDogb3V0ZXJbaXRlbS5pbmRleCAtIDFdICsgc2VsZi5vcHRpb25zLnN0cm9rZS5nYXA7XG4gICAgaW5uZXJbaXRlbS5pbmRleF0gPSByYWRpdXM7XG4gICAgcmV0dXJuIHJhZGl1cztcbiAgfVxuXG4gIGZ1bmN0aW9uIG91dGVyUmFkaXVzKGl0ZW0pIHtcbiAgICB2YXIgcmFkaXVzID0gb3V0ZXJbaXRlbS5pbmRleF07XG4gICAgaWYgKHJhZGl1cykgcmV0dXJuIHJhZGl1cztcblxuICAgIC8vIGJhc2VkIG9uIHRoZSBwcmV2aW91cyBpbm5lciByYWRpdXMgKyBzdHJva2Ugd2lkdGhcbiAgICByYWRpdXMgPSBpbm5lcltpdGVtLmluZGV4XSArIHNlbGYub3B0aW9ucy5zdHJva2Uud2lkdGg7XG4gICAgb3V0ZXJbaXRlbS5pbmRleF0gPSByYWRpdXM7XG4gICAgcmV0dXJuIHJhZGl1cztcbiAgfVxuXG4gIHNlbGYucHJvZ3Jlc3MgPSBkMy5hcmMoKVxuICAgIC5zdGFydEFuZ2xlKDApXG4gICAgLmVuZEFuZ2xlKGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgICByZXR1cm4gaXRlbS5wZXJjZW50YWdlIC8gMTAwICogz4Q7XG4gICAgfSlcbiAgICAuaW5uZXJSYWRpdXMoaW5uZXJSYWRpdXMpXG4gICAgLm91dGVyUmFkaXVzKG91dGVyUmFkaXVzKVxuICAgIC5jb3JuZXJSYWRpdXMoZnVuY3Rpb24gKGQpIHtcbiAgICAgIC8vIFdvcmthcm91bmQgZm9yIGQzIGJ1ZyBodHRwczovL2dpdGh1Yi5jb20vbWJvc3RvY2svZDMvaXNzdWVzLzIyNDlcbiAgICAgIC8vIFJlZHVjZSBjb3JuZXIgcmFkaXVzIHdoZW4gY29ybmVycyBhcmUgY2xvc2UgZWFjaCBvdGhlclxuICAgICAgdmFyIG0gPSBkLnBlcmNlbnRhZ2UgPj0gOTAgPyAoMTAwIC0gZC5wZXJjZW50YWdlKSAqIDAuMSA6IDE7XG4gICAgICByZXR1cm4gKHNlbGYub3B0aW9ucy5zdHJva2Uud2lkdGggLyAyKSAqIG07XG4gICAgfSk7XG5cbiAgdmFyIGJhY2tncm91bmQgPSBkMy5hcmMoKVxuICAgIC5zdGFydEFuZ2xlKDApXG4gICAgLmVuZEFuZ2xlKM+EKVxuICAgIC5pbm5lclJhZGl1cyhpbm5lclJhZGl1cylcbiAgICAub3V0ZXJSYWRpdXMob3V0ZXJSYWRpdXMpO1xuXG4gIC8vIGNyZWF0ZSBzdmdcbiAgc2VsZi5zdmcgPSBkMy5zZWxlY3QocXVlcnkpLmFwcGVuZChcInN2Z1wiKVxuICAgIC5hdHRyKFwicHJlc2VydmVBc3BlY3RSYXRpb1wiLFwieE1pbllNaW4gbWVldFwiKVxuICAgIC5hdHRyKFwidmlld0JveFwiLCBkaW0pXG4gICAgLmFwcGVuZChcImdcIilcbiAgICAuYXR0cihcInRyYW5zZm9ybVwiLCBcInRyYW5zbGF0ZShcIiArIHdpZHRoIC8gMiArIFwiLFwiICsgaGVpZ2h0IC8gMiArIFwiKVwiKTtcblxuICAvLyBhZGQgZ3JhZGllbnRzIGRlZnNcbiAgdmFyIGRlZnMgPSBzZWxmLnN2Zy5hcHBlbmQoXCJzdmc6ZGVmc1wiKTtcbiAgc2VyaWVzLmZvckVhY2goZnVuY3Rpb24gKGl0ZW0pIHtcbiAgICBpZiAoaXRlbS5jb2xvci5saW5lYXJHcmFkaWVudCB8fCBpdGVtLmNvbG9yLnJhZGlhbEdyYWRpZW50KSB7XG4gICAgICB2YXIgZ3JhZGllbnQgPSBSYWRpYWxQcm9ncmVzc0NoYXJ0LkdyYWRpZW50LnRvU1ZHRWxlbWVudCgnZ3JhZGllbnQnICsgaXRlbS5pbmRleCwgaXRlbS5jb2xvcik7XG4gICAgICBkZWZzLm5vZGUoKS5hcHBlbmRDaGlsZChncmFkaWVudCk7XG4gICAgfVxuICB9KTtcblxuICAvLyBhZGQgc2hhZG93cyBkZWZzXG4gIGRlZnMgPSBzZWxmLnN2Zy5hcHBlbmQoXCJzdmc6ZGVmc1wiKTtcbiAgdmFyIGRyb3BzaGFkb3dJZCA9IFwiZHJvcHNoYWRvdy1cIiArIE1hdGgucmFuZG9tKCk7XG4gIHZhciBmaWx0ZXIgPSBkZWZzLmFwcGVuZChcImZpbHRlclwiKS5hdHRyKFwiaWRcIiwgZHJvcHNoYWRvd0lkKTtcbiAgaWYoc2VsZi5vcHRpb25zLnNoYWRvdy53aWR0aCA+IDApIHtcbiAgICBcbiAgICBmaWx0ZXIuYXBwZW5kKFwiZmVHYXVzc2lhbkJsdXJcIilcbiAgICAgIC5hdHRyKFwiaW5cIiwgXCJTb3VyY2VBbHBoYVwiKVxuICAgICAgLmF0dHIoXCJzdGREZXZpYXRpb25cIiwgc2VsZi5vcHRpb25zLnNoYWRvdy53aWR0aClcbiAgICAgIC5hdHRyKFwicmVzdWx0XCIsIFwiYmx1clwiKTtcblxuICAgIGZpbHRlci5hcHBlbmQoXCJmZU9mZnNldFwiKVxuICAgICAgLmF0dHIoXCJpblwiLCBcImJsdXJcIilcbiAgICAgIC5hdHRyKFwiZHhcIiwgMSlcbiAgICAgIC5hdHRyKFwiZHlcIiwgMSlcbiAgICAgIC5hdHRyKFwicmVzdWx0XCIsIFwib2Zmc2V0Qmx1clwiKTtcbiAgfVxuXG4gIHZhciBmZU1lcmdlID0gZmlsdGVyLmFwcGVuZChcImZlTWVyZ2VcIik7XG4gIGZlTWVyZ2UuYXBwZW5kKFwiZmVNZXJnZU5vZGVcIikuYXR0cihcImluXCIsIFwib2Zmc2V0Qmx1clwiKTtcbiAgZmVNZXJnZS5hcHBlbmQoXCJmZU1lcmdlTm9kZVwiKS5hdHRyKFwiaW5cIiwgXCJTb3VyY2VHcmFwaGljXCIpO1xuXG4gIC8vIGFkZCBpbm5lciB0ZXh0XG4gIGlmIChzZWxmLm9wdGlvbnMuY2VudGVyKSB7XG4gICAgc2VsZi5zdmcuYXBwZW5kKFwidGV4dFwiKVxuICAgICAgLmF0dHIoJ2NsYXNzJywgJ3JiYy1jZW50ZXItdGV4dCcpXG4gICAgICAuYXR0cihcInRleHQtYW5jaG9yXCIsIFwibWlkZGxlXCIpXG4gICAgICAuYXR0cigneCcsIHNlbGYub3B0aW9ucy5jZW50ZXIueCArICdweCcpXG4gICAgICAuYXR0cigneScsIHNlbGYub3B0aW9ucy5jZW50ZXIueSArICdweCcpXG4gICAgICAuc2VsZWN0QWxsKCd0c3BhbicpXG4gICAgICAuZGF0YShzZWxmLm9wdGlvbnMuY2VudGVyLmNvbnRlbnQpLmVudGVyKClcbiAgICAgIC5hcHBlbmQoJ3RzcGFuJylcbiAgICAgIC5hdHRyKFwiZG9taW5hbnQtYmFzZWxpbmVcIiwgZnVuY3Rpb24gKCkge1xuXG4gICAgICAgIC8vIFNpbmdsZSBsaW5lcyBjYW4gZWFzaWx5IGNlbnRlcmVkIGluIHRoZSBtaWRkbGUgdXNpbmcgZG9taW5hbnQtYmFzZWxpbmUsIG11bHRpbGluZSBuZWVkIHRvIHVzZSB5XG4gICAgICAgIGlmIChzZWxmLm9wdGlvbnMuY2VudGVyLmNvbnRlbnQubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgcmV0dXJuICdjZW50cmFsJztcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICAgIC5hdHRyKCdjbGFzcycsIGZ1bmN0aW9uIChkLCBpKSB7XG4gICAgICAgIHJldHVybiAncmJjLWNlbnRlci10ZXh0LWxpbmUnICsgaTtcbiAgICAgIH0pXG4gICAgICAuYXR0cigneCcsIDApXG4gICAgICAuYXR0cignZHknLCBmdW5jdGlvbiAoZCwgaSkge1xuICAgICAgICBpZiAoaSA+IDApIHtcbiAgICAgICAgICByZXR1cm4gJzEuMWVtJztcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICAgIC5lYWNoKGZ1bmN0aW9uIChkKSB7XG4gICAgICAgIGlmICh0eXBlb2YgZCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgIHRoaXMuY2FsbGJhY2sgPSBkO1xuICAgICAgICB9XG4gICAgICB9KVxuICAgICAgLnRleHQoZnVuY3Rpb24gKGQpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBkID09PSAnc3RyaW5nJykge1xuICAgICAgICAgIHJldHVybiBkO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuICcnO1xuICAgICAgfSk7XG4gIH1cblxuICAvLyBhZGQgcmluZyBzdHJ1Y3R1cmVcbiAgc2VsZi5maWVsZCA9IHNlbGYuc3ZnLnNlbGVjdEFsbChcImdcIilcbiAgICAuZGF0YShzZXJpZXMpXG4gICAgLmVudGVyKCkuYXBwZW5kKFwiZ1wiKTtcblxuICBzZWxmLmZpZWxkLmFwcGVuZChcInBhdGhcIikuYXR0cihcImNsYXNzXCIsIFwicHJvZ3Jlc3NcIikuYXR0cihcImZpbHRlclwiLCBcInVybCgjXCIgKyBkcm9wc2hhZG93SWQgK1wiKVwiKTtcblxuICBzZWxmLmZpZWxkLmFwcGVuZChcInBhdGhcIikuYXR0cihcImNsYXNzXCIsIFwiYmdcIilcbiAgICAuc3R5bGUoXCJmaWxsXCIsIGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgICByZXR1cm4gaXRlbS5jb2xvci5iYWNrZ3JvdW5kO1xuICAgIH0pXG4gICAgLnN0eWxlKFwib3BhY2l0eVwiLCAwLjIpXG4gICAgLmF0dHIoXCJkXCIsIGJhY2tncm91bmQpO1xuXG4gIHNlbGYuZmllbGQuYXBwZW5kKFwidGV4dFwiKVxuICAgIC5jbGFzc2VkKCdyYmMtbGFiZWwgcmJjLWxhYmVsLXN0YXJ0JywgdHJ1ZSlcbiAgICAuYXR0cihcImRvbWluYW50LWJhc2VsaW5lXCIsIFwiY2VudHJhbFwiKVxuICAgIC5hdHRyKFwieFwiLCBcIjEwXCIpXG4gICAgLmF0dHIoXCJ5XCIsIGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgICByZXR1cm4gLShcbiAgICAgICAgc2VsZi5vcHRpb25zLmRpYW1ldGVyIC8gMiArXG4gICAgICAgIGl0ZW0uaW5kZXggKiAoc2VsZi5vcHRpb25zLnN0cm9rZS5nYXAgKyBzZWxmLm9wdGlvbnMuc3Ryb2tlLndpZHRoKSArXG4gICAgICAgIHNlbGYub3B0aW9ucy5zdHJva2Uud2lkdGggLyAyXG4gICAgICAgICk7XG4gICAgfSlcbiAgICAudGV4dChmdW5jdGlvbiAoaXRlbSkge1xuICAgICAgcmV0dXJuIGl0ZW0ubGFiZWxTdGFydDtcbiAgICB9KTtcblxuICBzZWxmLnVwZGF0ZSgpO1xufVxuXG4vKipcbiAqIFVwZGF0ZSBkYXRhIHRvIGJlIHZpc3VhbGl6ZWQgaW4gdGhlIGNoYXJ0LlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fEFycmF5fSBkYXRhIE9wdGlvbmFsIGRhdGEgeW91J2QgbGlrZSB0byBzZXQgZm9yIHRoZSBjaGFydCBiZWZvcmUgaXQgd2lsbCB1cGRhdGUuIElmIG5vdCBzcGVjaWZpZWQgdGhlIHVwZGF0ZSBtZXRob2Qgd2lsbCB1c2UgdGhlIGRhdGEgdGhhdCBpcyBhbHJlYWR5IGNvbmZpZ3VyZWQgd2l0aCB0aGUgY2hhcnQuXG4gKiBAZXhhbXBsZSB1cGRhdGUoWzcwLCAxMCwgNDVdKVxuICogQGV4YW1wbGUgdXBkYXRlKHtzZXJpZXM6IFt7dmFsdWU6IDcwfSwgMTAsIDQ1XX0pXG4gKlxuICovXG5SYWRpYWxQcm9ncmVzc0NoYXJ0LnByb3RvdHlwZS51cGRhdGUgPSBmdW5jdGlvbiAoZGF0YSkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgLy8gcGFyc2UgbmV3IGRhdGFcbiAgaWYgKGRhdGEpIHtcbiAgICBpZiAodHlwZW9mIGRhdGEgPT09ICdudW1iZXInKSB7XG4gICAgICBkYXRhID0gW2RhdGFdO1xuICAgIH1cblxuICAgIHZhciBzZXJpZXM7XG5cbiAgICBpZiAoQXJyYXkuaXNBcnJheShkYXRhKSkge1xuICAgICAgc2VyaWVzID0gZGF0YTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBkYXRhID09PSAnb2JqZWN0Jykge1xuICAgICAgc2VyaWVzID0gZGF0YS5zZXJpZXMgfHwgW107XG4gICAgfVxuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzZXJpZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHRoaXMub3B0aW9ucy5zZXJpZXNbaV0ucHJldmlvdXNWYWx1ZSA9IHRoaXMub3B0aW9ucy5zZXJpZXNbaV0udmFsdWU7XG5cbiAgICAgIHZhciBpdGVtID0gc2VyaWVzW2ldO1xuICAgICAgaWYgKHR5cGVvZiBpdGVtID09PSAnbnVtYmVyJykge1xuICAgICAgICB0aGlzLm9wdGlvbnMuc2VyaWVzW2ldLnZhbHVlID0gaXRlbTtcbiAgICAgIH0gZWxzZSBpZiAodHlwZW9mIGl0ZW0gPT09ICdvYmplY3QnKSB7XG4gICAgICAgIHRoaXMub3B0aW9ucy5zZXJpZXNbaV0udmFsdWUgPSBpdGVtLnZhbHVlO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIGNhbGN1bGF0ZSBmcm9tIHBlcmNlbnRhZ2UgYW5kIG5ldyBwZXJjZW50YWdlIGZvciB0aGUgcHJvZ3Jlc3MgYW5pbWF0aW9uXG4gIHNlbGYub3B0aW9ucy5zZXJpZXMuZm9yRWFjaChmdW5jdGlvbiAoaXRlbSkge1xuICAgIGl0ZW0uZnJvbVBlcmNlbnRhZ2UgPSBpdGVtLnBlcmNlbnRhZ2UgPyBpdGVtLnBlcmNlbnRhZ2UgOiA1O1xuICAgIGl0ZW0ucGVyY2VudGFnZSA9IChpdGVtLnZhbHVlIC0gc2VsZi5vcHRpb25zLm1pbikgKiAxMDAgLyAoc2VsZi5vcHRpb25zLm1heCAtIHNlbGYub3B0aW9ucy5taW4pO1xuICB9KTtcblxuICB2YXIgY2VudGVyID0gc2VsZi5zdmcuc2VsZWN0KFwidGV4dC5yYmMtY2VudGVyLXRleHRcIik7XG5cbiAgLy8gcHJvZ3Jlc3NcbiAgc2VsZi5maWVsZC5zZWxlY3QoXCJwYXRoLnByb2dyZXNzXCIpXG4gICAgLmludGVycnVwdCgpXG4gICAgLnRyYW5zaXRpb24oKVxuICAgIC5kdXJhdGlvbihzZWxmLm9wdGlvbnMuYW5pbWF0aW9uLmR1cmF0aW9uKVxuICAgIC5kZWxheShmdW5jdGlvbiAoZCwgaSkge1xuICAgICAgLy8gZGVsYXkgYmV0d2VlbiBlYWNoIGl0ZW1cbiAgICAgIHJldHVybiBpICogc2VsZi5vcHRpb25zLmFuaW1hdGlvbi5kZWxheTtcbiAgICB9KVxuICAgIC5lYXNlKGQzLmVhc2VFbGFzdGljKVxuICAgIC5hdHRyVHdlZW4oXCJkXCIsIGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgICB2YXIgaW50ZXJwb2xhdG9yID0gZDMuaW50ZXJwb2xhdGVOdW1iZXIoaXRlbS5mcm9tUGVyY2VudGFnZSwgaXRlbS5wZXJjZW50YWdlKTtcbiAgICAgIHJldHVybiBmdW5jdGlvbiAodCkge1xuICAgICAgICBpdGVtLnBlcmNlbnRhZ2UgPSBpbnRlcnBvbGF0b3IodCk7XG4gICAgICAgIHJldHVybiBzZWxmLnByb2dyZXNzKGl0ZW0pO1xuICAgICAgfTtcbiAgICB9KVxuICAgIC50d2VlbihcImNlbnRlclwiLCBmdW5jdGlvbiAoaXRlbSkge1xuICAgICAgLy8gRXhlY3V0ZSBjYWxsYmFja3Mgb24gZWFjaCBsaW5lXG4gICAgICBpZiAoc2VsZi5vcHRpb25zLmNlbnRlcikge1xuICAgICAgICB2YXIgaW50ZXJwb2xhdGUgPSBzZWxmLm9wdGlvbnMucm91bmQgPyBkMy5pbnRlcnBvbGF0ZVJvdW5kIDogZDMuaW50ZXJwb2xhdGVOdW1iZXI7XG4gICAgICAgIHZhciBpbnRlcnBvbGF0b3IgPSBpbnRlcnBvbGF0ZShpdGVtLnByZXZpb3VzVmFsdWUgfHwgMCwgaXRlbS52YWx1ZSk7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAodCkge1xuICAgICAgICAgIGNlbnRlclxuICAgICAgICAgICAgLnNlbGVjdEFsbCgndHNwYW4nKVxuICAgICAgICAgICAgLmVhY2goZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICBpZiAodGhpcy5jYWxsYmFjaykge1xuICAgICAgICAgICAgICAgIGQzLnNlbGVjdCh0aGlzKS50ZXh0KHRoaXMuY2FsbGJhY2soaW50ZXJwb2xhdG9yKHQpLCBpdGVtLmluZGV4LCBpdGVtKSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuICAgICAgfVxuICAgIH0pXG4gICAgLnR3ZWVuKFwiaW50ZXJwb2xhdGUtY29sb3JcIiwgZnVuY3Rpb24gKGl0ZW0pIHtcbiAgICAgIGlmIChpdGVtLmNvbG9yLmludGVycG9sYXRlICYmIGl0ZW0uY29sb3IuaW50ZXJwb2xhdGUubGVuZ3RoID09IDIpIHtcbiAgICAgICAgdmFyIGNvbG9ySW50ZXJwb2xhdG9yID0gZDMuaW50ZXJwb2xhdGVIc2woaXRlbS5jb2xvci5pbnRlcnBvbGF0ZVswXSwgaXRlbS5jb2xvci5pbnRlcnBvbGF0ZVsxXSk7XG5cbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uICh0KSB7XG4gICAgICAgICAgdmFyIGNvbG9yID0gY29sb3JJbnRlcnBvbGF0b3IoaXRlbS5wZXJjZW50YWdlIC8gMTAwKTtcbiAgICAgICAgICBkMy5zZWxlY3QodGhpcykuc3R5bGUoJ2ZpbGwnLCBjb2xvcik7XG4gICAgICAgICAgZDMuc2VsZWN0KHRoaXMucGFyZW50Tm9kZSkuc2VsZWN0KCdwYXRoLmJnJykuc3R5bGUoJ2ZpbGwnLCBjb2xvcik7XG4gICAgICAgIH07XG4gICAgICB9XG4gICAgfSlcbiAgICAuc3R5bGUoXCJmaWxsXCIsIGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgICBpZiAoaXRlbS5jb2xvci5zb2xpZCkge1xuICAgICAgICByZXR1cm4gaXRlbS5jb2xvci5zb2xpZDtcbiAgICAgIH1cblxuICAgICAgaWYgKGl0ZW0uY29sb3IubGluZWFyR3JhZGllbnQgfHwgaXRlbS5jb2xvci5yYWRpYWxHcmFkaWVudCkge1xuICAgICAgICByZXR1cm4gXCJ1cmwoI2dyYWRpZW50XCIgKyBpdGVtLmluZGV4ICsgJyknO1xuICAgICAgfVxuICAgIH0pO1xufTtcblxuLyoqXG4gKiBSZW1vdmUgc3ZnIGFuZCBjbGVhbiBzb21lIHJlZmVyZW5jZXNcbiAqL1xuUmFkaWFsUHJvZ3Jlc3NDaGFydC5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uICgpIHtcbiAgdGhpcy5zdmcucmVtb3ZlKCk7XG4gIGRlbGV0ZSB0aGlzLnN2Zztcbn07XG5cbi8qKlxuICogRGV0YWNoIGFuZCBub3JtYWxpemUgdXNlcidzIG9wdGlvbnMgaW5wdXQuXG4gKi9cblJhZGlhbFByb2dyZXNzQ2hhcnQubm9ybWFsaXplT3B0aW9ucyA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gIGlmICghb3B0aW9ucyB8fCB0eXBlb2Ygb3B0aW9ucyAhPT0gJ29iamVjdCcpIHtcbiAgICBvcHRpb25zID0ge307XG4gIH1cblxuICB2YXIgX29wdGlvbnMgPSB7XG4gICAgZGlhbWV0ZXI6IG9wdGlvbnMuZGlhbWV0ZXIgfHwgMTAwLFxuICAgIHN0cm9rZToge1xuICAgICAgd2lkdGg6IG9wdGlvbnMuc3Ryb2tlICYmIG9wdGlvbnMuc3Ryb2tlLndpZHRoIHx8IDQwLFxuICAgICAgZ2FwOiAoIW9wdGlvbnMuc3Ryb2tlIHx8IG9wdGlvbnMuc3Ryb2tlLmdhcCA9PT0gdW5kZWZpbmVkKSA/IDIgOiBvcHRpb25zLnN0cm9rZS5nYXBcbiAgICB9LFxuICAgIHNoYWRvdzoge1xuICAgICAgd2lkdGg6ICghb3B0aW9ucy5zaGFkb3cgfHwgb3B0aW9ucy5zaGFkb3cud2lkdGggPT09IG51bGwpID8gNCA6IG9wdGlvbnMuc2hhZG93LndpZHRoXG4gICAgfSxcbiAgICBhbmltYXRpb246IHtcbiAgICAgIGR1cmF0aW9uOiBvcHRpb25zLmFuaW1hdGlvbiAmJiBvcHRpb25zLmFuaW1hdGlvbi5kdXJhdGlvbiB8fCAxNzUwLFxuICAgICAgZGVsYXk6IG9wdGlvbnMuYW5pbWF0aW9uICYmIG9wdGlvbnMuYW5pbWF0aW9uLmRlbGF5IHx8IDIwMFxuICAgIH0sXG4gICAgbWluOiBvcHRpb25zLm1pbiB8fCAwLFxuICAgIG1heDogb3B0aW9ucy5tYXggfHwgMTAwLFxuICAgIHJvdW5kOiBvcHRpb25zLnJvdW5kICE9PSB1bmRlZmluZWQgPyAhIW9wdGlvbnMucm91bmQgOiB0cnVlLFxuICAgIHNlcmllczogb3B0aW9ucy5zZXJpZXMgfHwgW10sXG4gICAgY2VudGVyOiBSYWRpYWxQcm9ncmVzc0NoYXJ0Lm5vcm1hbGl6ZUNlbnRlcihvcHRpb25zLmNlbnRlcilcbiAgfTtcblxuICB2YXIgZGVmYXVsdENvbG9yc0l0ZXJhdG9yID0gbmV3IFJhZGlhbFByb2dyZXNzQ2hhcnQuQ29sb3JzSXRlcmF0b3IoKTtcbiAgZm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IF9vcHRpb25zLnNlcmllcy5sZW5ndGg7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgIHZhciBpdGVtID0gb3B0aW9ucy5zZXJpZXNbaV07XG5cbiAgICAvLyBjb252ZXJ0IG51bWJlciB0byBvYmplY3RcbiAgICBpZiAodHlwZW9mIGl0ZW0gPT09ICdudW1iZXInKSB7XG4gICAgICBpdGVtID0ge3ZhbHVlOiBpdGVtfTtcbiAgICB9XG5cbiAgICBfb3B0aW9ucy5zZXJpZXNbaV0gPSB7XG4gICAgICBpbmRleDogaSxcbiAgICAgIHZhbHVlOiBpdGVtLnZhbHVlLFxuICAgICAgbGFiZWxTdGFydDogaXRlbS5sYWJlbFN0YXJ0LFxuICAgICAgY29sb3I6IFJhZGlhbFByb2dyZXNzQ2hhcnQubm9ybWFsaXplQ29sb3IoaXRlbS5jb2xvciwgZGVmYXVsdENvbG9yc0l0ZXJhdG9yKVxuICAgIH07XG4gIH1cblxuICByZXR1cm4gX29wdGlvbnM7XG59O1xuXG4vKipcbiAqIE5vcm1hbGl6ZSBkaWZmZXJlbnQgbm90YXRpb25zIG9mIGNvbG9yIHByb3BlcnR5XG4gKlxuICogQHBhcmFtIHtTdHJpbmd8QXJyYXl8T2JqZWN0fSBjb2xvclxuICogQGV4YW1wbGUgJyNmZTA4YjUnXG4gKiBAZXhhbXBsZSB7IHNvbGlkOiAnI2ZlMDhiNScsIGJhY2tncm91bmQ6ICcjMDAwMDAwJyB9XG4gKiBAZXhhbXBsZSBbJyMwMDAwMDAnLCAnI2ZmMDAwMCddXG4gKiBAZXhhbXBsZSB7XG4gICAgICAgICAgICAgICAgbGluZWFyR3JhZGllbnQ6IHsgeDE6ICcwJScsIHkxOiAnMTAwJScsIHgyOiAnNTAlJywgeTI6ICcwJSd9LFxuICAgICAgICAgICAgICAgIHN0b3BzOiBbXG4gICAgICAgICAgICAgICAgICB7b2Zmc2V0OiAnMCUnLCAnc3RvcC1jb2xvcic6ICcjZmUwOGI1JywgJ3N0b3Atb3BhY2l0eSc6IDF9LFxuICAgICAgICAgICAgICAgICAge29mZnNldDogJzEwMCUnLCAnc3RvcC1jb2xvcic6ICcjZmYxNDEwJywgJ3N0b3Atb3BhY2l0eSc6IDF9XG4gICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICB9XG4gKiBAZXhhbXBsZSB7XG4gICAgICAgICAgICAgICAgcmFkaWFsR3JhZGllbnQ6IHtjeDogJzYwJywgY3k6ICc2MCcsIHI6ICc1MCd9LFxuICAgICAgICAgICAgICAgIHN0b3BzOiBbXG4gICAgICAgICAgICAgICAgICB7b2Zmc2V0OiAnMCUnLCAnc3RvcC1jb2xvcic6ICcjZmUwOGI1JywgJ3N0b3Atb3BhY2l0eSc6IDF9LFxuICAgICAgICAgICAgICAgICAge29mZnNldDogJzEwMCUnLCAnc3RvcC1jb2xvcic6ICcjZmYxNDEwJywgJ3N0b3Atb3BhY2l0eSc6IDF9XG4gICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICB9XG4gKlxuICovXG5SYWRpYWxQcm9ncmVzc0NoYXJ0Lm5vcm1hbGl6ZUNvbG9yID0gZnVuY3Rpb24gKGNvbG9yLCBkZWZhdWx0Q29sb3JzSXRlcmF0b3IpIHtcblxuICBpZiAoIWNvbG9yKSB7XG4gICAgY29sb3IgPSB7c29saWQ6IGRlZmF1bHRDb2xvcnNJdGVyYXRvci5uZXh0KCl9O1xuICB9IGVsc2UgaWYgKHR5cGVvZiBjb2xvciA9PT0gJ3N0cmluZycpIHtcbiAgICBjb2xvciA9IHtzb2xpZDogY29sb3J9O1xuICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoY29sb3IpKSB7XG4gICAgY29sb3IgPSB7aW50ZXJwb2xhdGU6IGNvbG9yfTtcbiAgfSBlbHNlIGlmICh0eXBlb2YgY29sb3IgPT09ICdvYmplY3QnKSB7XG4gICAgaWYgKCFjb2xvci5zb2xpZCAmJiAhY29sb3IuaW50ZXJwb2xhdGUgJiYgIWNvbG9yLmxpbmVhckdyYWRpZW50ICYmICFjb2xvci5yYWRpYWxHcmFkaWVudCkge1xuICAgICAgY29sb3Iuc29saWQgPSBkZWZhdWx0Q29sb3JzSXRlcmF0b3IubmV4dCgpO1xuICAgIH1cbiAgfVxuXG4gIC8vIFZhbGlkYXRlIGludGVycG9sYXRlIHN5bnRheFxuICBpZiAoY29sb3IuaW50ZXJwb2xhdGUpIHtcbiAgICBpZiAoY29sb3IuaW50ZXJwb2xhdGUubGVuZ3RoICE9PSAyKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ2ludGVycG9sYXRlIGFycmF5IHNob3VsZCBjb250YWluIHR3byBjb2xvcnMnKTtcbiAgICB9XG4gIH1cblxuICAvLyBWYWxpZGF0ZSBncmFkaWVudCBzeW50YXhcbiAgaWYgKGNvbG9yLmxpbmVhckdyYWRpZW50IHx8IGNvbG9yLnJhZGlhbEdyYWRpZW50KSB7XG4gICAgaWYgKCFjb2xvci5zdG9wcyB8fCAhQXJyYXkuaXNBcnJheShjb2xvci5zdG9wcykgfHwgY29sb3Iuc3RvcHMubGVuZ3RoICE9PSAyKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ2dyYWRpZW50IHN5bnRheCBpcyBtYWxmb3JtZWQnKTtcbiAgICB9XG4gIH1cblxuICAvLyBTZXQgYmFja2dyb3VuZCB3aGVuIGlzIG5vdCBwcm92aWRlZFxuICBpZiAoIWNvbG9yLmJhY2tncm91bmQpIHtcbiAgICBpZiAoY29sb3Iuc29saWQpIHtcbiAgICAgIGNvbG9yLmJhY2tncm91bmQgPSBjb2xvci5zb2xpZDtcbiAgICB9IGVsc2UgaWYgKGNvbG9yLmludGVycG9sYXRlKSB7XG4gICAgICBjb2xvci5iYWNrZ3JvdW5kID0gY29sb3IuaW50ZXJwb2xhdGVbMF07XG4gICAgfSBlbHNlIGlmIChjb2xvci5saW5lYXJHcmFkaWVudCB8fCBjb2xvci5yYWRpYWxHcmFkaWVudCkge1xuICAgICAgY29sb3IuYmFja2dyb3VuZCA9IGNvbG9yLnN0b3BzWzBdWydzdG9wLWNvbG9yJ107XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGNvbG9yO1xuXG59O1xuXG5cbi8qKlxuICogTm9ybWFsaXplIGRpZmZlcmVudCBub3RhdGlvbnMgb2YgY2VudGVyIHByb3BlcnR5XG4gKlxuICogQHBhcmFtIHtTdHJpbmd8QXJyYXl8RnVuY3Rpb258T2JqZWN0fSBjZW50ZXJcbiAqIEBleGFtcGxlICdmb28gYmFyJ1xuICogQGV4YW1wbGUgeyBjb250ZW50OiAnZm9vIGJhcicsIHg6IDEwLCB5OiA0IH1cbiAqIEBleGFtcGxlIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCwgaXRlbSkge31cbiAqIEBleGFtcGxlIFsnZm9vIGJhcicsIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCwgaXRlbSkge31dXG4gKi9cblJhZGlhbFByb2dyZXNzQ2hhcnQubm9ybWFsaXplQ2VudGVyID0gZnVuY3Rpb24gKGNlbnRlcikge1xuICBpZiAoIWNlbnRlcikgcmV0dXJuIG51bGw7XG5cbiAgLy8gQ29udmVydCB0byBvYmplY3Qgbm90YXRpb25cbiAgaWYgKGNlbnRlci5jb25zdHJ1Y3RvciAhPT0gT2JqZWN0KSB7XG4gICAgY2VudGVyID0ge2NvbnRlbnQ6IGNlbnRlcn07XG4gIH1cblxuICAvLyBEZWZhdWx0c1xuICBjZW50ZXIuY29udGVudCA9IGNlbnRlci5jb250ZW50IHx8IFtdO1xuICBjZW50ZXIueCA9IGNlbnRlci54IHx8IDA7XG4gIGNlbnRlci55ID0gY2VudGVyLnkgfHwgMDtcblxuICAvLyBDb252ZXJ0IGNvbnRlbnQgdG8gYXJyYXkgbm90YXRpb25cbiAgaWYgKCFBcnJheS5pc0FycmF5KGNlbnRlci5jb250ZW50KSkge1xuICAgIGNlbnRlci5jb250ZW50ID0gW2NlbnRlci5jb250ZW50XTtcbiAgfVxuXG4gIHJldHVybiBjZW50ZXI7XG59O1xuXG4vLyBMaW5lYXIgb3IgUmFkaWFsIEdyYWRpZW50IGludGVybmFsIG9iamVjdFxuUmFkaWFsUHJvZ3Jlc3NDaGFydC5HcmFkaWVudCA9IChmdW5jdGlvbiAoKSB7XG4gIGZ1bmN0aW9uIEdyYWRpZW50KCkge1xuICB9XG5cbiAgR3JhZGllbnQudG9TVkdFbGVtZW50ID0gZnVuY3Rpb24gKGlkLCBvcHRpb25zKSB7XG4gICAgdmFyIGdyYWRpZW50VHlwZSA9IG9wdGlvbnMubGluZWFyR3JhZGllbnQgPyAnbGluZWFyR3JhZGllbnQnIDogJ3JhZGlhbEdyYWRpZW50JztcbiAgICB2YXIgZ3JhZGllbnQgPSBkMy5zZWxlY3QoZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFwiLy93d3cudzMub3JnLzIwMDAvc3ZnXCIsIGdyYWRpZW50VHlwZSkpLmF0dHIoJ2lkJywgaWQpO1xuXG4gICAgT2JqZWN0LmtleXMob3B0aW9uc1tncmFkaWVudFR5cGVdKS5mb3JFYWNoKGtleSA9PiB7XG4gICAgICBncmFkaWVudC5hdHRyKGtleSwgb3B0aW9uc1tncmFkaWVudFR5cGVdW2tleV0pO1xuICAgIH0pO1xuXG4gICAgb3B0aW9ucy5zdG9wcy5mb3JFYWNoKGZ1bmN0aW9uIChzdG9wQXR0cnMpIHtcbiAgICAgIGNvbnN0IHN0b3AgPSBncmFkaWVudC5hcHBlbmQoXCJzdmc6c3RvcFwiKTtcblxuICAgICAgT2JqZWN0LmtleXMoc3RvcEF0dHJzKS5mb3JFYWNoKGtleSA9PiB7XG4gICAgICAgIHN0b3AuYXR0cihrZXksIHN0b3BBdHRyc1trZXldKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgdGhpcy5iYWNrZ3JvdW5kID0gb3B0aW9ucy5zdG9wc1swXVsnc3RvcC1jb2xvciddO1xuXG4gICAgcmV0dXJuIGdyYWRpZW50Lm5vZGUoKTtcbiAgfTtcblxuICByZXR1cm4gR3JhZGllbnQ7XG59KSgpO1xuXG4vLyBEZWZhdWx0IGNvbG9ycyBpdGVyYXRvclxuUmFkaWFsUHJvZ3Jlc3NDaGFydC5Db2xvcnNJdGVyYXRvciA9IChmdW5jdGlvbiAoKSB7XG5cbiAgQ29sb3JzSXRlcmF0b3IuREVGQVVMVF9DT0xPUlMgPSBbXCIjMWFkNWRlXCIsIFwiI2EwZmYwM1wiLCBcIiNlOTBiM2FcIiwgJyNmZjk1MDAnLCAnIzAwN2FmZicsICcjZmZjYzAwJywgJyM1ODU2ZDYnLCAnIzhlOGU5MyddO1xuXG4gIGZ1bmN0aW9uIENvbG9yc0l0ZXJhdG9yKCkge1xuICAgIHRoaXMuaW5kZXggPSAwO1xuICB9XG5cbiAgQ29sb3JzSXRlcmF0b3IucHJvdG90eXBlLm5leHQgPSBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKHRoaXMuaW5kZXggPT09IENvbG9yc0l0ZXJhdG9yLkRFRkFVTFRfQ09MT1JTLmxlbmd0aCkge1xuICAgICAgdGhpcy5pbmRleCA9IDA7XG4gICAgfVxuXG4gICAgcmV0dXJuIENvbG9yc0l0ZXJhdG9yLkRFRkFVTFRfQ09MT1JTW3RoaXMuaW5kZXgrK107XG4gIH07XG5cbiAgcmV0dXJuIENvbG9yc0l0ZXJhdG9yO1xufSkoKTtcblxuXG4vLyBFeHBvcnQgUmFkaWFsUHJvZ3Jlc3NDaGFydCBvYmplY3RcbmlmICh0eXBlb2YgbW9kdWxlICE9PSBcInVuZGVmaW5lZFwiKW1vZHVsZS5leHBvcnRzID0gUmFkaWFsUHJvZ3Jlc3NDaGFydDsiXX0=
