import os
import html

# Define input and output paths
input_path = os.path.join("singlefile", "index.html")
output_dir = os.path.join("singlefile")
output_path = os.path.join(output_dir, "index.svg")

def convert_html_to_svg():
    # Check if the source HTML file exists
    if not os.path.exists(input_path):
        print(f"Error: Could not find '{input_path}'")
        return

    # Read the original HTML content
    with open(input_path, "r", encoding="utf-8") as f:
        raw_html = f.read()

    # Escape the HTML so it can safely sit inside an iframe's srcdoc attribute
    # without breaking the outer SVG/XML structure
    escaped_html = html.escape(raw_html, quote=True)

    # Create the SVG wrapper using <foreignObject> and a full-viewport <iframe>
    # Using an iframe with srcdoc preserves your <!DOCTYPE>, <head>, CSS, and JS context cleanly
    svg_content = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
  <foreignObject width="100%" height="100%" x="0" y="0">
    <div xmlns="http://www.w3.org/1999/xhtml" style="margin: 0; padding: 0; width: 100vw; height: 100vh; overflow: hidden;">
      <iframe 
        srcdoc="{escaped_html}" 
        style="width: 100%; height: 100%; border: none; display: block;"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals">
      </iframe>
    </div>
  </foreignObject>
</svg>'''

    # Ensure the output directory exists (including the space in "single file")
    os.makedirs(output_dir, exist_ok=True)

    # Write the resulting SVG file
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(svg_content)

    print(f"Success! Encoded '{input_path}' -> '{output_path}'")

if __name__ == "__main__":
    convert_html_to_svg()