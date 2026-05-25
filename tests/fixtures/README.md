# Regression fixtures

Drop a single known-positive image at `known_positive.jpg` to enable the
model regression test in CI. The image must contain at least one person
that the production model detects with confidence ≥ 0.25.

Recommended choice: one of the smaller (~50–200 KB) positive images from
the `real_data` test split. Keep it small so the repo stays slim.

If absent, `TestModelRegression` is skipped. Set
`GOLDENEYE_REGRESSION_IMAGE=/abs/path/to/image.jpg` to override locally.
