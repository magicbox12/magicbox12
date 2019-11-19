const { diff, reverse, formatters } = require("jsondiffpatch")

var left = { a: 3, b: 4, items: ["a", "b", "c", "d"] }
var right = { a: 5, c: 9, items: ["a", "c", "d", "e"] }

var delta = diff(left, right);
var delta2 = reverse(left, delta);

console.log(delta);
console.log(delta2);

// beautiful html diff
document.getElementById("html").innerHTML = formatters.html.format(delta, left);

// self-explained json
document.getElementById("annotated").innerHTML = formatters.annotated.format(
  delta,
  left
);