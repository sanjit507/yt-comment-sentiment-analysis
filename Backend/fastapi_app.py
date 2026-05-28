import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend before importing pyplot

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse, StreamingResponse
import io
import matplotlib.pyplot as plt
from wordcloud import WordCloud
import mlflow
import joblib
import re
import pandas as pd
from pathlib import Path
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer
import matplotlib.dates as mdates
import os
from urllib.parse import urlparse, parse_qs
import requests
from dotenv import load_dotenv

app = FastAPI()

load_dotenv()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def configure_local_mlflow_tracking() -> str:
    """Configure MLflow to use a local file-backed tracking store."""
    root_dir = Path(__file__).resolve().parents[1]
    mlruns_dir = root_dir / 'mlruns'
    mlruns_dir.mkdir(parents=True, exist_ok=True)
    return mlruns_dir.resolve().as_uri()


def preprocess_comment(comment: str) -> str:
    """Apply preprocessing transformations to a comment."""
    try:
        # Convert to lowercase
        comment = comment.lower()

        # Remove trailing and leading whitespaces
        comment = comment.strip()

        # Remove newline characters
        comment = re.sub(r'\n', ' ', comment)

        # Remove non-alphanumeric characters, except punctuation
        comment = re.sub(r'[^A-Za-z0-9\s!?.,]', '', comment)

        # Remove stopwords but retain important ones for sentiment analysis
        stop_words = set(stopwords.words('english')) - {'not', 'but', 'however', 'no', 'yet'}
        comment = ' '.join([word for word in comment.split() if word not in stop_words])

        # Lemmatize the words
        lemmatizer = WordNetLemmatizer()
        comment = ' '.join([lemmatizer.lemmatize(word) for word in comment.split()])

        return comment
    except Exception as e:
        print(f"Error in preprocessing comment: {e}")
        return comment


def load_model_and_vectorizer(model_name: str, model_version: str, vectorizer_path: str):
    """Load the MLflow model and TF-IDF vectorizer."""
    mlflow.set_tracking_uri(configure_local_mlflow_tracking())
    model_uri = f"models:/{model_name}/{model_version}"
    model = mlflow.pyfunc.load_model(model_uri)
    vectorizer = joblib.load(vectorizer_path)
    return model, vectorizer


def build_model_input(preprocessed_comments):
    """Vectorize comments and convert them to the schema expected by MLflow."""
    transformed_comments = vectorizer.transform(preprocessed_comments)
    feature_names = vectorizer.get_feature_names_out()
    return pd.DataFrame(transformed_comments.toarray(), columns=feature_names)


def resolve_youtube_video_id(video_id: str | None, video_url: str | None) -> str:
    if video_id:
        return video_id.strip()

    if not video_url:
        return ''

    try:
        parsed = urlparse(video_url)
        hostname = parsed.hostname or ''
        hostname = hostname.replace('www.', '')
        if hostname == 'youtu.be':
            return parsed.path.lstrip('/')
        if 'youtube.com' in hostname:
            if parsed.path.startswith('/watch'):
                return parse_qs(parsed.query).get('v', [''])[0]
            if parsed.path.startswith('/shorts/'):
                return parsed.path.split('/shorts/', 1)[1].split('/')[0]
        return ''
    except Exception:
        return ''


def fetch_youtube_comments(video_id: str, api_key: str, max_comments: int) -> list[str]:
    comments: list[str] = []
    next_page_token = None

    while len(comments) < max_comments:
        params = {
            'part': 'snippet',
            'videoId': video_id,
            'maxResults': 100,
            'textFormat': 'plainText',
            'key': api_key,
        }
        if next_page_token:
            params['pageToken'] = next_page_token

        response = requests.get(
            'https://www.googleapis.com/youtube/v3/commentThreads',
            params=params,
            timeout=20,
        )
        if response.status_code != 200:
            raise HTTPException(status_code=502, detail=f"YouTube API error: {response.text}")

        payload = response.json()
        for item in payload.get('items', []):
            snippet = item.get('snippet', {}).get('topLevelComment', {}).get('snippet', {})
            text = snippet.get('textDisplay') or snippet.get('textOriginal')
            if text:
                comments.append(text)
            if len(comments) >= max_comments:
                break

        next_page_token = payload.get('nextPageToken')
        if not next_page_token:
            break

    return comments


repo_root = Path(__file__).resolve().parents[1]
model, vectorizer = load_model_and_vectorizer(
    "yt_chrome_plugin_model",
    "1",
    str(repo_root / "tfidf_vectorizer.pkl"),
)


@app.get("/", response_class=PlainTextResponse)
def home():
    return "Welcome to our fastapi api"


@app.post("/predict_with_timestamps")
def predict_with_timestamps(payload: dict):
    comments_data = payload.get('comments')
    if not comments_data:
        raise HTTPException(status_code=400, detail="No comments provided")

    try:
        comments = [item['text'] for item in comments_data]
        timestamps = [item['timestamp'] for item in comments_data]

        preprocessed_comments = [preprocess_comment(comment) for comment in comments]
        transformed_comments = build_model_input(preprocessed_comments)

        predictions = model.predict(transformed_comments).tolist()
        predictions = [str(pred) for pred in predictions]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")

    return [
        {"comment": comment, "sentiment": sentiment, "timestamp": timestamp}
        for comment, sentiment, timestamp in zip(comments, predictions, timestamps)
    ]


@app.post("/predict")
def predict(payload: dict):
    comments = payload.get('comments')
    if not comments:
        raise HTTPException(status_code=400, detail="No comments provided")

    try:
        preprocessed_comments = [preprocess_comment(comment) for comment in comments]
        transformed_comments = build_model_input(preprocessed_comments)

        predictions = model.predict(transformed_comments).tolist()
        predictions = [str(pred) for pred in predictions]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")

    return [
        {"comment": comment, "sentiment": sentiment}
        for comment, sentiment in zip(comments, predictions)
    ]


@app.post("/generate_chart")
def generate_chart(payload: dict):
    try:
        sentiment_counts = payload.get('sentiment_counts')
        if not sentiment_counts:
            raise HTTPException(status_code=400, detail="No sentiment counts provided")

        labels = ['Positive', 'Neutral', 'Negative']
        sizes = [
            int(sentiment_counts.get('1', 0)),
            int(sentiment_counts.get('0', 0)),
            int(sentiment_counts.get('-1', 0))
        ]
        if sum(sizes) == 0:
            raise ValueError("Sentiment counts sum to zero")

        colors = ['#36A2EB', '#C9CBCF', '#FF6384']

        plt.figure(figsize=(6, 6))
        plt.pie(
            sizes,
            labels=labels,
            colors=colors,
            autopct='%1.1f%%',
            startangle=140,
            textprops={'color': 'w'}
        )
        plt.axis('equal')

        img_io = io.BytesIO()
        plt.savefig(img_io, format='PNG', transparent=True)
        img_io.seek(0)
        plt.close()

        return StreamingResponse(img_io, media_type='image/png')
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chart generation failed: {str(e)}")


@app.post("/generate_wordcloud")
def generate_wordcloud(payload: dict):
    try:
        comments = payload.get('comments')
        if not comments:
            raise HTTPException(status_code=400, detail="No comments provided")

        preprocessed_comments = [preprocess_comment(comment) for comment in comments]
        text = ' '.join(preprocessed_comments)

        wordcloud = WordCloud(
            width=800,
            height=400,
            background_color='black',
            colormap='Blues',
            stopwords=set(stopwords.words('english')),
            collocations=False
        ).generate(text)

        img_io = io.BytesIO()
        wordcloud.to_image().save(img_io, format='PNG')
        img_io.seek(0)

        return StreamingResponse(img_io, media_type='image/png')
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Word cloud generation failed: {str(e)}")


@app.post("/generate_trend_graph")
def generate_trend_graph(payload: dict):
    try:
        sentiment_data = payload.get('sentiment_data')
        if not sentiment_data:
            raise HTTPException(status_code=400, detail="No sentiment data provided")

        df = pd.DataFrame(sentiment_data)
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        df.set_index('timestamp', inplace=True)
        df['sentiment'] = df['sentiment'].astype(int)

        sentiment_labels = {-1: 'Negative', 0: 'Neutral', 1: 'Positive'}

        monthly_counts = df.resample('M')['sentiment'].value_counts().unstack(fill_value=0)
        monthly_totals = monthly_counts.sum(axis=1)
        monthly_percentages = (monthly_counts.T / monthly_totals).T * 100

        for sentiment_value in [-1, 0, 1]:
            if sentiment_value not in monthly_percentages.columns:
                monthly_percentages[sentiment_value] = 0

        monthly_percentages = monthly_percentages[[-1, 0, 1]]

        plt.figure(figsize=(12, 6))

        colors = {
            -1: 'red',
            0: 'gray',
            1: 'green'
        }

        for sentiment_value in [-1, 0, 1]:
            plt.plot(
                monthly_percentages.index,
                monthly_percentages[sentiment_value],
                marker='o',
                linestyle='-',
                label=sentiment_labels[sentiment_value],
                color=colors[sentiment_value]
            )

        plt.title('Monthly Sentiment Percentage Over Time')
        plt.xlabel('Month')
        plt.ylabel('Percentage of Comments (%)')
        plt.grid(True)
        plt.xticks(rotation=45)

        plt.gca().xaxis.set_major_formatter(mdates.DateFormatter('%Y-%m'))
        plt.gca().xaxis.set_major_locator(mdates.AutoDateLocator(maxticks=12))

        plt.legend()
        plt.tight_layout()

        img_io = io.BytesIO()
        plt.savefig(img_io, format='PNG')
        img_io.seek(0)
        plt.close()

        return StreamingResponse(img_io, media_type='image/png')
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Trend graph generation failed: {str(e)}")


@app.get("/youtube/comments")
def youtube_comments(
    video_id: str | None = Query(default=None),
    video_url: str | None = Query(default=None),
    max_comments: int = Query(default=500, ge=1, le=2000),
):
    api_key = os.getenv('YOUTUBE_API_KEY')
    if not api_key:
        raise HTTPException(status_code=500, detail="Missing YOUTUBE_API_KEY in the environment")

    resolved_id = resolve_youtube_video_id(video_id, video_url)
    if not resolved_id:
        raise HTTPException(status_code=400, detail="Provide a valid video_id or video_url")

    comments = fetch_youtube_comments(resolved_id, api_key, max_comments)
    return {"video_id": resolved_id, "count": len(comments), "comments": comments}
