# Figma capability check

12 October 2026. Connection selected by user: Figma. Authenticated plan: Starter, View seat, team admin. Actual create_new_file and use_figma calls succeeded; the seat label alone did not determine effective tool access.

Can create/edit frames, editable text/vectors, Auto Layout components/variant sets, variables and local text/effect styles. Both Fraunces and Plus Jakarta Sans are available with verified style names. Not read-only. File: https://www.figma.com/design/JwVhPmEJoyxV6ZO9JxfSe2

Observed plan limits: adding a second variable mode returned “Limited to 1 modes only”; a fourth page returned “The Starter plan only comes with 3 pages.” User selected separate collections for all eight themes. Pages are Cover, Foundations, Components; the remaining requested page names become named sections on Components. Auto is a static Rose daytime specimen; use Midnight for night. Eight-mode flipping cannot be verified literally on Starter; equivalent sample rebinding is verified instead.

Other observed tool limits: a return exceeding 20,480 bytes aborts without committing canvas changes; vectorPaths rejected SVG arc command A (cubic curves used instead). These failed calls reported safeToRetryWithoutCanvasRead=true. No rate-limit rejection observed. Exact quota/reset was not returned; do not infer unlimited calls. get_libraries listed community kits; targeted searches for Button, color/bg and Fraunces returned no assets, so this library was created locally. No Code Connect files were found in the repo; source typography is system default, replaced in design by the explicitly requested fonts.

## Every available Figma tool

Update at handoff: the Starter MCP tool-call quota was reached during final QA. Figma refused further canvas inspection/editing. The earlier discovery-stage statement that no rate-limit rejection had been observed is superseded by this actual rejection. whoami still succeeded and reconfirmed Starter; quota reset timing was not supplied.

- `add_code_connect_map`
- `create_generative_plugin`
- `create_new_file`
- `create_shader`
- `download_assets`
- `export_video`
- `generate_deck`
- `generate_diagram`
- `generate_figma_design`
- `get_code_connect_map`
- `get_code_connect_suggestions`
- `get_context_for_code_connect`
- `get_design_context`
- `get_figjam`
- `get_generative_plugin`
- `get_libraries`
- `get_metadata`
- `get_motion_context`
- `get_screenshot`
- `get_shader`
- `get_variable_defs`
- `list_file_components_for_code_connect`
- `list_file_shaders`
- `list_generative_plugins`
- `list_shaders`
- `open_figma_mcp_app_in_thread`
- `search_design_system`
- `send_code_connect_mappings`
- `update_generative_plugin`
- `update_shader`
- `upload_assets`
- `use_figma`
- `weave_cancel_tool_run`
- `weave_find_model`
- `weave_get_model_run_output`
- `weave_get_tool_inputs`
- `weave_get_tool_run_output`
- `weave_list_tools`
- `weave_run_model`
- `weave_run_tool`
- `weave_upload_asset`
- `whoami`
