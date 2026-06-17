print("Hello, World!");

const name = "Cognit";

const version = 0.1;

const is_awesome = true;

function add(a, b) {
  return (a + b);
}

print("2 + 2 = " + String(add(2, 2)) + "");

function factorial(n) {
  return ((n <= 1) ? 1 : (n * factorial((n - 1))));
}

print("factorial(5) = " + String(factorial(5)) + "");

function greet(name) {
  return "Hello, " + String(name) + "!";
}

print(greet("World"));

let count = 0;

count = (count + 1);

print("count = " + String(count) + "");

const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const doubled = map(numbers, function(x) {
  return (x * 2);
});

print("doubled: " + String(doubled) + "");

const evens = filter(numbers, function(x) {
  return ((x % 2) == 0);
});

print("evens: " + String(evens) + "");

function describe(n) {
  return   (() => {
    const __match_val__ = n;
  if (__match_val__ === 0) { return "zero"; }
  if (__match_val__ === 1) { return "one"; }
  if (__match_val__ === 2) { return "two"; }
  { const _ = __match_val__; return "many"; }
  })()
;
}

for (const i of [0, 1, 2, 3]) {
  print("" + String(i) + " -> " + String(describe(i)) + "");
}

function grade(score) {
  return   (function() {
    if ((score >= 90)) {
      return "A";
    }
    else if ((score >= 80)) {
      return "B";
    }
    else if ((score >= 70)) {
      return "C";
    }
    else if ((score >= 60)) {
      return "D";
    }
    else {
      return "F";
    }
  })()
;
}

const scores = [95, 82, 73, 64, 55];

for (const s of scores) {
  print("Score " + String(s) + ": " + String(grade(s)) + "");
}

print("Done!");
