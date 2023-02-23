const cache: any = {};

export function tmpl(input: string, data: any = null): string {
  var fn = !/\W/.test(input)
    ? (cache[input] =
        cache[input] || tmpl(document.getElementById(input)?.innerHTML ?? ""))
    : new Function(
        "obj",
        "var p=[],print=function(){p.push.apply(p,arguments);};p.push('" +
          input
            .replace(/[\r\t\n]/g, " ")
            //.split("<%").join("\t")
            .split("{{")
            .join("\t")
            //.replace(/((^|%>)[^\t]*)'/g, "$1\r")
            .replace(/((^|}})[^\t]*)'/g, "$1\r")
            //.replace(/\t=(.*?)%>/g, "',$1,'")
            .replace(/\t=(.*?)}}/g, "',$1,'")
            .split("\t")
            .join("');")
            //.split("%>").join("p.push('")
            .split("}}")
            .join("p.push('")
            .split("\r")
            .join("\\'") +
          "');return p.join('');"
      );

  return data ? wrap(data) : wrap;

  function wrap(data: any) {
    return fn.call(data);
  }
}
