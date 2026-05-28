yt-comment-sentiment-analysis
==============================

A YouTube comment sentiment analysis platform with a local ML pipeline, a Flask inference API, a standalone frontend, and a Chrome extension for browser-side workflows.

Project Overview
----------------

<img width="544" height="748" alt="Screenshot 2026-05-28 151327" src="https://github.com/user-attachments/assets/2c31347d-363d-4931-a68a-94f4fc45c7ef" />


<img width="1503" height="822" alt="Screenshot 2026-05-28 151351" src="https://github.com/user-attachments/assets/0a4204b8-ccf6-4279-bcb1-64fa949b539d" />


<img width="1526" height="791" alt="Screenshot 2026-05-28 151413" src="https://github.com/user-attachments/assets/973d3d1a-5f99-4bba-b265-b801c6e7050f" />


<img width="1541" height="475" alt="Screenshot 2026-05-28 151425" src="https://github.com/user-attachments/assets/7bb6b945-cb74-4754-aa5a-df88871b0d5b" />














This project classifies YouTube comments into positive, neutral, and negative sentiment. The training and evaluation pipeline is managed with DVC and MLflow, the model is served through Flask, and the experience is exposed through a clean browser frontend plus a Chrome extension.

It is designed to demonstrate an end-to-end applied machine learning workflow:

* data ingestion and preprocessing
* feature extraction with TF-IDF
* LightGBM model training and evaluation
* experiment tracking and model registry with MLflow
* local inference through a REST API
* a browser frontend and Chrome extension for real usage

Tech Stack
----------

* Python
* Flask
* scikit-learn
* LightGBM
* MLflow
* DVC
* pandas, NumPy, NLTK
* HTML, CSS, JavaScript
* Chrome Extension Manifest V3

How It Works
------------

1. Raw comment data is loaded into the pipeline and cleaned.
2. Text is normalized, tokenized, and vectorized with TF-IDF.
3. A LightGBM classifier is trained on the processed features.
4. MLflow logs the experiment, model artifact, and registry version locally.
5. The Flask app loads the registered model and exposes `/predict`.
6. The frontend and Chrome extension send comment text to the API and display sentiment results.

Why It Stands Out
-----------------

* End-to-end machine learning product, not just a notebook.
* Local-first setup that works without a remote MLflow server.
* Separate frontend and Chrome extension for practical deployment scenarios.
* Clear project structure that is easy for reviewers and recruiters to scan.

Project Organization
------------

    ├── LICENSE
    ├── Makefile           <- Makefile with commands like `make data` or `make train`
    ├── README.md          <- The top-level README for developers using this project.
    ├── data
    │   ├── external       <- Data from third party sources.
    │   ├── interim        <- Intermediate data that has been transformed.
    │   ├── processed      <- The final, canonical data sets for modeling.
    │   └── raw            <- The original, immutable data dump.
    │
    ├── docs               <- A default Sphinx project; see sphinx-doc.org for details
    │
    ├── models             <- Trained and serialized models, model predictions, or model summaries
    │
    ├── notebooks          <- Jupyter notebooks. Naming convention is a number (for ordering),
    │                         the creator's initials, and a short `-` delimited description, e.g.
    │                         `1.0-jqp-initial-data-exploration`.
    │
    ├── references         <- Data dictionaries, manuals, and all other explanatory materials.
    │
    ├── reports            <- Generated analysis as HTML, PDF, LaTeX, etc.
    │   └── figures        <- Generated graphics and figures to be used in reporting
    │
    ├── frontend           <- Standalone web frontend for sentiment analysis
    ├── chrome-extension   <- Manifest V3 Chrome extension for YouTube comments
    │
    ├── requirements.txt   <- The requirements file for reproducing the analysis environment, e.g.
    │                         generated with `pip freeze > requirements.txt`
    │
    ├── setup.py           <- makes project pip installable (pip install -e .) so src can be imported
    ├── src                <- Source code for use in this project.
    │   ├── __init__.py    <- Makes src a Python module
    │   │
    │   ├── data           <- Scripts to download or generate data
    │   │   └── make_dataset.py
    │   │
    │   ├── features       <- Scripts to turn raw data into features for modeling
    │   │   └── build_features.py
    │   │
    │   ├── models         <- Scripts to train models and then use trained models to make
    │   │   │                 predictions
    │   │   ├── predict_model.py
    │   │   └── train_model.py
    │   │
    │   └── visualization  <- Scripts to create exploratory and results oriented visualizations
    │       └── visualize.py
    │
    └── tox.ini            <- tox file with settings for running tox; see tox.readthedocs.io

Frontend and Chrome extension
----------------------------

The Flask API stays in `flask_app/`. The `frontend/` folder contains a standalone static UI that talks to `http://127.0.0.1:5000/predict`.

To run it locally, start the Flask app first, then open `frontend/index.html` in a browser or serve the folder with a simple static server.

The `chrome-extension/` folder contains a Manifest V3 extension that can scan visible YouTube comments on the current page and send them to the local API for prediction.

The extension now includes a polished home popup and a separate More page for endpoint settings, usage guidance, and production notes.

To load the extension, open Chrome's Extensions page, enable Developer Mode, and load the `chrome-extension/` folder as an unpacked extension.

Local Setup
-----------

1. Create and activate your virtual environment.
2. Install dependencies from `requirements.txt`.
3. Run the DVC pipeline if you want to rebuild the model artifacts.
4. Start the Flask API from the repo root:

     ```powershell
     python flask_app/app.py
     ```

5. Open `frontend/index.html` in a browser or serve the `frontend/` folder locally.
6. Load `chrome-extension/` as an unpacked extension in Chrome.

API Notes
---------

The frontend and extension call the local API endpoint:

```text
http://127.0.0.1:5000/predict
```

The request body should look like this:

```json
{
    "comments": ["This video is great!", "I absolutely hate this video"]
}
```

The response returns each comment with a predicted sentiment label.








--------

<p><small>Project based on the <a target="_blank" href="https://drivendata.github.io/cookiecutter-data-science/">cookiecutter data science project template</a>. #cookiecutterdatascience</small></p>
