import { Link } from "@solidjs/meta";
import { JSXElement } from "solid-js";

export function FavIcon(): JSXElement {
  return (
    <Link
      id="favicon"
      rel="shortcut icon"
      type="image/svg+xml"
      href="/images/gdgoc-logo.svg"
    />
  );
}
