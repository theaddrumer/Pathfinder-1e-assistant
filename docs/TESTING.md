# Independent tester checklist

Use a disposable save and your own original or suitably licensed test image. A fresh tester's account setup is part of the test, not an assumption.

1. Follow SETUP.md from a clean download. Record any missing prerequisite or unclear step.
2. Connect your own tunnel; have the AI call kernel_status and report engine 3.51.0. A map opening alone does not verify the AI connection.
3. Confirm a new save starts without someone else's encounter or artwork.
4. Import a test background, align its grid and reveal a small area. Check that the player view hides the rest and GM-layer tokens remain hidden.
5. Publish a disposable player token with showVitals:true; click its square and check HP/conditions.
6. Use a plain dice roll, then a small normal action through the calculator. Check that the AI uses supported tools rather than inventing results.
7. Stop the launcher, restart with the same save, and verify that the map/state survived. Test an update only after backing up that save.

Report the exact download name and first failing step. Do not include your secret, organization/workspace identifiers, purchased maps or real campaign data. The desktop edition needs its separate host test; Ubuntu success does not establish desktop success.

For automated developer checks, see BUILDING.md and PACKAGING_REPORT.md. Archived engine test reports describe earlier runs, not a claim that every historical/browser test was rerun for this packaging update.
