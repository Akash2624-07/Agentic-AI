# Data

`hour.csv` is the hourly table of the UCI Bike Sharing dataset (Capital
Bikeshare, Washington D.C., 2011-2012), unchanged.

- Source: https://archive.ics.uci.edu/dataset/275/bike+sharing+dataset
- License: CC BY 4.0
- Citation: Fanaee-T, Hadi, and Gama, Joao, "Event labeling combining ensemble
  detectors and background knowledge", Progress in Artificial Intelligence
  (2013): pp. 1-15, Springer Berlin Heidelberg, doi:10.1007/s13748-013-0040-3.

The faults the demo replays (temperature in °C, an empty humidity feed) are
injected at load time by `src/data.py`; this file stays clean.
