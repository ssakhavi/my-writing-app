//! Reads markdown from stdin, parses it with `pulldown-cmark`, and prints a
//! JSON summary of the structural elements found (headings, emphasis, lists,
//! links, images, code blocks, tables, rules, blockquotes) plus the rendered
//! HTML and the raw inline text.
//!
//! This exists so the frontend round-trip test can verify Milkdown's
//! serialized markdown output re-parses into the *semantically correct*
//! structure via `pulldown-cmark` — the actual Rust crate the app will use
//! for save-time validation — without needing the full Tauri crate (and its
//! GTK/WebKit system dependencies) to compile.

use std::io::{self, Read};

use pulldown_cmark::{CodeBlockKind, Event, HeadingLevel, Options, Parser, Tag, TagEnd};
use serde::Serialize;

#[derive(Serialize, Default)]
struct ImageFound {
    url: String,
    alt: String,
    title: String,
}

#[derive(Serialize, Default)]
struct LinkFound {
    url: String,
    text: String,
}

#[derive(Serialize, Default)]
struct CodeBlockFound {
    lang: Option<String>,
    text: String,
}

#[derive(Serialize, Default)]
struct TableFound {
    /// Body rows only — pulldown-cmark emits the header via `Tag::TableHead`,
    /// not `Tag::TableRow`, so the header isn't counted here.
    rows: usize,
    cols: usize,
}

#[derive(Serialize, Default)]
struct Findings {
    heading_levels: Vec<u8>,
    has_bold: bool,
    has_italic: bool,
    has_strikethrough: bool,
    has_inline_code: bool,
    has_blockquote: bool,
    has_rule: bool,
    unordered_list_items: usize,
    ordered_list_items: usize,
    task_items: Vec<bool>,
    links: Vec<LinkFound>,
    images: Vec<ImageFound>,
    code_blocks: Vec<CodeBlockFound>,
    tables: Vec<TableFound>,
    /// All plain text runs concatenated with '\n', in document order. Useful
    /// for checking things pulldown-cmark doesn't structurally parse (e.g.
    /// $...$ math delimiters, which survive only as literal text).
    plain_text: String,
    html: String,
}

fn heading_level_to_u8(level: HeadingLevel) -> u8 {
    match level {
        HeadingLevel::H1 => 1,
        HeadingLevel::H2 => 2,
        HeadingLevel::H3 => 3,
        HeadingLevel::H4 => 4,
        HeadingLevel::H5 => 5,
        HeadingLevel::H6 => 6,
    }
}

fn analyze(markdown: &str) -> Findings {
    let mut options = Options::empty();
    options.insert(Options::ENABLE_TABLES);
    options.insert(Options::ENABLE_STRIKETHROUGH);
    options.insert(Options::ENABLE_TASKLISTS);
    options.insert(Options::ENABLE_FOOTNOTES);
    options.insert(Options::ENABLE_SMART_PUNCTUATION);

    let parser = Parser::new_ext(markdown, options);

    let mut findings = Findings::default();
    let mut current_table_cols = 0usize;
    let mut current_table_rows = 0usize;
    let mut in_table = false;
    let mut current_code_lang: Option<String> = None;
    let mut current_code_text = String::new();
    let mut in_code_block = false;
    let mut current_link: Option<LinkFound> = None;
    let mut current_image: Option<ImageFound> = None;
    // Tracks whether each currently-open list (lists can nest) is ordered,
    // so `Tag::Item` can attribute itself to the right counter.
    let mut list_ordered_stack: Vec<bool> = Vec::new();

    let events: Vec<Event> = parser.collect();

    // Re-render HTML from the same event stream (events are Clone).
    let mut html_out = String::new();
    pulldown_cmark::html::push_html(&mut html_out, events.clone().into_iter());
    findings.html = html_out;

    for event in events {
        match event {
            Event::Start(tag) => match tag {
                Tag::Heading { level, .. } => {
                    findings.heading_levels.push(heading_level_to_u8(level));
                }
                Tag::Strong => findings.has_bold = true,
                Tag::Emphasis => findings.has_italic = true,
                Tag::Strikethrough => findings.has_strikethrough = true,
                Tag::BlockQuote(_) => findings.has_blockquote = true,
                Tag::List(start) => {
                    list_ordered_stack.push(start.is_some());
                }
                Tag::Item => match list_ordered_stack.last() {
                    Some(true) => findings.ordered_list_items += 1,
                    Some(false) => findings.unordered_list_items += 1,
                    None => {}
                },
                Tag::CodeBlock(kind) => {
                    in_code_block = true;
                    current_code_text.clear();
                    current_code_lang = match kind {
                        CodeBlockKind::Fenced(lang) if !lang.is_empty() => Some(lang.to_string()),
                        _ => None,
                    };
                }
                Tag::Table(alignments) => {
                    in_table = true;
                    current_table_cols = alignments.len();
                    current_table_rows = 0;
                }
                Tag::TableRow => {
                    if in_table {
                        current_table_rows += 1;
                    }
                }
                Tag::Link { dest_url, .. } => {
                    current_link = Some(LinkFound {
                        url: dest_url.to_string(),
                        text: String::new(),
                    });
                }
                Tag::Image {
                    dest_url, title, ..
                } => {
                    current_image = Some(ImageFound {
                        url: dest_url.to_string(),
                        alt: String::new(),
                        title: title.to_string(),
                    });
                }
                _ => {}
            },
            Event::End(tag_end) => match tag_end {
                TagEnd::CodeBlock => {
                    in_code_block = false;
                    findings.code_blocks.push(CodeBlockFound {
                        lang: current_code_lang.take(),
                        text: current_code_text.clone(),
                    });
                }
                TagEnd::Table => {
                    in_table = false;
                    findings.tables.push(TableFound {
                        rows: current_table_rows,
                        cols: current_table_cols,
                    });
                }
                TagEnd::Link => {
                    if let Some(link) = current_link.take() {
                        findings.links.push(link);
                    }
                }
                TagEnd::Image => {
                    if let Some(image) = current_image.take() {
                        findings.images.push(image);
                    }
                }
                TagEnd::List(_) => {
                    list_ordered_stack.pop();
                }
                _ => {}
            },
            Event::Text(text) => {
                if in_code_block {
                    current_code_text.push_str(&text);
                } else if let Some(image) = current_image.as_mut() {
                    // Text events between Start(Image)/End(Image) are the
                    // image's alt text, per pulldown-cmark's event model.
                    image.alt.push_str(&text);
                } else {
                    if let Some(link) = current_link.as_mut() {
                        link.text.push_str(&text);
                    }
                    findings.plain_text.push_str(&text);
                    findings.plain_text.push('\n');
                }
            }
            Event::Code(text) => {
                findings.has_inline_code = true;
                findings.plain_text.push_str(&text);
                findings.plain_text.push('\n');
            }
            Event::Rule => findings.has_rule = true,
            Event::TaskListMarker(checked) => findings.task_items.push(checked),
            _ => {}
        }
    }

    findings
}

fn main() {
    let mut input = String::new();
    io::stdin()
        .read_to_string(&mut input)
        .expect("failed to read markdown from stdin");

    let findings = analyze(&input);
    println!(
        "{}",
        serde_json::to_string(&findings).expect("failed to serialize findings")
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finds_headings() {
        let findings = analyze("# One\n\n## Two\n");
        assert_eq!(findings.heading_levels, vec![1, 2]);
    }

    #[test]
    fn finds_emphasis_and_inline_code() {
        let findings = analyze("**bold** *italic* ~~strike~~ `code`\n");
        assert!(findings.has_bold);
        assert!(findings.has_italic);
        assert!(findings.has_strikethrough);
        assert!(findings.has_inline_code);
    }

    #[test]
    fn counts_unordered_and_ordered_list_items_separately() {
        let findings = analyze("- a\n- b\n- c\n\n1. x\n2. y\n");
        assert_eq!(findings.unordered_list_items, 3);
        assert_eq!(findings.ordered_list_items, 2);
    }

    #[test]
    fn counts_task_items_and_checked_state() {
        let findings = analyze("- [ ] todo\n- [x] done\n");
        assert_eq!(findings.task_items, vec![false, true]);
        // Task items are still list items.
        assert_eq!(findings.unordered_list_items, 2);
    }

    #[test]
    fn finds_blockquote_and_rule() {
        let findings = analyze("> quoted\n\n---\n");
        assert!(findings.has_blockquote);
        assert!(findings.has_rule);
    }

    #[test]
    fn finds_link_url_and_text() {
        let findings = analyze("[example](https://example.com)\n");
        assert_eq!(findings.links.len(), 1);
        assert_eq!(findings.links[0].url, "https://example.com");
        assert_eq!(findings.links[0].text, "example");
    }

    #[test]
    fn finds_image_url_and_preserves_alt_text() {
        let findings = analyze("![a diagram of the thing](https://example.com/x.png)\n");
        assert_eq!(findings.images.len(), 1);
        assert_eq!(findings.images[0].url, "https://example.com/x.png");
        assert_eq!(findings.images[0].alt, "a diagram of the thing");
    }

    #[test]
    fn finds_fenced_code_block_language_and_body() {
        let findings = analyze("```js\nconst x = 1;\n```\n");
        assert_eq!(findings.code_blocks.len(), 1);
        assert_eq!(findings.code_blocks[0].lang.as_deref(), Some("js"));
        assert_eq!(findings.code_blocks[0].text, "const x = 1;\n");
    }

    #[test]
    fn finds_table_dimensions() {
        let findings = analyze("| a | b | c |\n| - | - | - |\n| 1 | 2 | 3 |\n| 4 | 5 | 6 |\n");
        assert_eq!(findings.tables.len(), 1);
        assert_eq!(findings.tables[0].cols, 3);
        // pulldown-cmark emits the header via `TableHead`, not `TableRow` —
        // `TableRow` only fires for body rows, so this counts the 2 body
        // rows, not the header.
        assert_eq!(findings.tables[0].rows, 2);
    }

    #[test]
    fn math_delimiters_survive_as_literal_text() {
        // pulldown-cmark has no math extension: $...$ is just text. This
        // documents that assumption so a future pulldown-cmark upgrade that
        // adds real math parsing doesn't silently change this behavior.
        let findings = analyze("Einstein: $E = mc^2$\n");
        assert!(findings.plain_text.contains("$E = mc^2$"));
    }
}
