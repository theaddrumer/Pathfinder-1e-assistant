# Player map coordinates — V3.48

The live player viewer shows spreadsheet-style columns and one-based rows. A1 is the top-left square. Columns continue Z, AA, AB; a 30 × 40 map ends at AD40. Rulers stay at the viewport's top/left edges while their labels track the panned/zoomed grid. Distant zoom levels thin labels to avoid overlap; hover identifies every square exactly.

Hover to see a coordinate. Click/tap to pin a reference square; Escape clears it. Dragging pans without changing the pin. Outlines are local viewing aids, not targets, reveals or token moves; nothing is sent to the server. Coordinates work over fog without exposing contents. Grid and creature/feature Labels toggles remain independent. The offline GM sandbox is unchanged.

## AI conversion

Commands still take zero-based numeric x/y, not A1 strings. Convert the column as a one-based base-26 letter sequence, then subtract one; subtract one from the row. A1 = (0,0), G12 = (6,11), Z1 = (25,0), AA1 = (26,0), AD40 = (29,39). Check current bounds; reject out-of-bounds references. Do not reverse row direction.

Ranges include both endpoints: B4:F9 means x=1..5, y=3..8, or `rect:{x:1,y:3,width:5,height:6}` where rect is supported. Translate the intended operation into existing commands; naming a coordinate alone does not authorize movement/reveal. Distinguish printed room labels such as room C2 from grid coordinates when ambiguous.

This is a display convention over the existing grid, not another position system. Coordinates do not rotate with background artwork. Same-map polls retain a pin; size/title changes clear it. No gameplay state or saved-map schema changes are required.
