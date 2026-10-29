use serde_json::{json, Value};
use std::collections::BTreeMap;

/// Compiler offsets are UTF-8 bytes; Monaco positions count UTF-16 code units.
/// Tabs are one model character, irrespective of their rendered width.
pub fn position(source: &str, offset: usize) -> (usize, usize) {
    let mut bound = offset.min(source.len());
    while !source.is_char_boundary(bound) {
        bound -= 1;
    }
    let prefix = &source[..bound];
    let line = prefix.bytes().filter(|byte| *byte == b'\n').count() + 1;
    let line_text = prefix.rsplit('\n').next().unwrap_or("");
    (line, line_text.encode_utf16().count() + 1)
}

pub fn parse(stderr: &str, files: &BTreeMap<String, String>) -> Vec<Value> {
    stderr.lines().filter_map(|line| serde_json::from_str::<Value>(line).ok())
        .filter(|item| item.get("code").is_some()).map(|raw| {
            let original_file = raw["file"].as_str().unwrap_or("<program>");
            let file = original_file.strip_prefix("/work/").unwrap_or(original_file).trim_start_matches("./");
            let text = files.get(file);
            let offset = raw["offset"].as_u64().unwrap_or(0) as usize;
            let length = raw["length"].as_u64().unwrap_or(1) as usize;
            let (start_line, start_column, end_line, end_column) = if let Some(text) = text {
                let (sl, sc) = position(text, offset);
                let (el, ec) = position(text, offset.saturating_add(length));
                (sl, sc, el, if sl == el && sc == ec { ec + 1 } else { ec })
            } else {
                (raw["line"].as_u64().unwrap_or(1) as usize, raw["column"].as_u64().unwrap_or(1) as usize,
                 raw["end_line"].as_u64().unwrap_or(1) as usize, raw["end_column"].as_u64().unwrap_or(2) as usize)
            };
            json!({"file":file,"message":raw["message"],"code":raw["code"],"severity":"error",
                "line":start_line,"column":start_column,"startLine":start_line,"startColumn":start_column,
                "startLineNumber":start_line,"endLine":end_line,"endLineNumber":end_line,"endColumn":end_column,
                "hint":raw["hint"],"original":raw})
        }).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn utf8_tabs_and_astral_characters() {
        let source = "package main\n\tprintln(\"ёж😀\")\n";
        let byte = source.find('😀').unwrap();
        assert_eq!(position(source, byte), (2, 13));
        assert_eq!(position(source, byte + 4), (2, 15));
        assert_eq!(position(source, byte + 1), (2, 13));
        assert_eq!(position("a\r\nb", 3), (2, 1));
    }
    #[test]
    fn raw_diagnostic_preserved() {
        let files = BTreeMap::from([("main.kr".to_string(), "\tёж😀bad".to_string())]);
        let raw = r#"{"kind":"error","code":"E107","message":"unknown name","file":"/work/main.kr","offset":9,"length":3}"#;
        let result = parse(raw, &files);
        assert_eq!(result[0]["startColumn"], 6);
        assert_eq!(result[0]["original"]["offset"], 9);
    }
}
