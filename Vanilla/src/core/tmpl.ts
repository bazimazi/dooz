function parse(template: string) {
  let result = /{{(.*?)}}/g.exec(template);
  const arr = [];
  let firstPos;

  while (result) {
    firstPos = result.index;
    if (firstPos !== 0) {
      arr.push(template.substring(0, firstPos));
      template = template.slice(firstPos);
    }

    arr.push(result[0]);
    template = template.slice(result[0].length);
    result = /{{(.*?)}}/g.exec(template);
  }

  if (template) arr.push(template);
  return arr;
}

function compileToString(template: string) {
  const ast = parse(template);
  let fnStr = `""`;

  ast.map(t => {
    if (t.startsWith("{{") && t.endsWith("}}")) {
      fnStr += `+data.${t.split(/{{|}}/).filter(Boolean)[0].trim()}`;
    } else {
      fnStr += `+"${t}"`;
    }
  });

  return fnStr;
}

export function tmpl(template: string) {
  return new Function("data", "return " + compileToString(template))
}