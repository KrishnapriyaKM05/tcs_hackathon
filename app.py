import os
import re
import json
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)

# Import google.genai SDK
try:
    from google import genai
    from google.genai import types
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False

SYSTEM_INSTRUCTION = """You are an intelligent, empathetic Academic and Career Counseling Agent. Your goal is to guide a student through an intake process using EXACTLY 3 concise questions, one at a time, and then recommend 1 to 3 ideal courses based strictly on their answers.

## Interactive Interview Sequence:
You must ask ONLY the following 3 questions progressively, ONE at a time:
1. Question 1 (Step "education"): "What is the highest education level you have completed or are currently pursuing?"
2. Question 2 (Step "field"): "What is your main interested field of study or technology area?"
3. Question 3 (Step "duration"): "What is your preferred course duration (e.g., Short 1-4 weeks, Medium 1-3 months, Long 3-6 months)?"

After the student answers Question 3, proceed immediately to the **Recommendation Phase**.

## Recommendation Phase (Final Step):
1. Enable Google Search grounding to discover real-world, currently active courses matching their highest education, field of study, and duration preference across platforms (Coursera, edX, Udemy, NPTEL, University Programs).
2. Provide a concise summary assessment connecting their 3 answers.
3. Provide STRICTLY 1 TO 3 COURSE RECOMMENDATIONS.

## Structured Output Mandate:
At the absolute end of your response, ALWAYS append a JSON payload block formatted exactly as shown below inside ```json ... ```:

```json
{
  "step": "education" | "field" | "duration" | "recommendation",
  "quick_replies": ["Quick answer 1", "Quick answer 2", "Quick answer 3", "Quick answer 4"],
  "is_final": false,
  "recommendations": [
    {
      "title": "Course Title",
      "platform": "Platform Name (e.g. Coursera, edX, Udemy)",
      "skills": ["Skill 1", "Skill 2", "Skill 3"],
      "match_reason": "Detailed explanation connecting their education level, field of study, and duration preference.",
      "link": "https://..."
    }
  ]
}
```

Rule for `step`:
- "education": when asking about highest education level.
- "field": when asking about interested field of study.
- "duration": when asking about preferred course duration.
- "recommendation": when providing the final course recommendations (set `is_final`: true).

Rule for `quick_replies`:
- Provide 3 to 4 realistic quick-reply options relevant to the current question so the student can click one instantly.
"""


def extract_json_payload(text):
    """Extracts JSON block embedded in ```json ... ``` markdown."""
    pattern = r'```json\s*(\{.*?\})\s*```'
    match = re.search(pattern, text, re.DOTALL)
    if match:
        try:
            payload = json.loads(match.group(1))
            clean_text = re.sub(pattern, '', text, flags=re.DOTALL).strip()
            return clean_text, payload
        except Exception as e:
            print("JSON parse error:", e)
    
    return text.strip(), None


def get_mock_response(history, user_msg):
    """Adaptive fallback counselor enforcing the 3 specific questions."""
    msg_lower = user_msg.lower()
    turn_count = len(history) // 2

    if turn_count == 0 or "start" in msg_lower or "hello" in msg_lower or "hi" in msg_lower:
        text = "Hello! 👋 Welcome to your personalized course counselor.\n\nTo recommend the best courses for you, I have just 3 quick questions.\n\n**1. What is the highest education level you have completed or are currently pursuing?**"
        payload = {
            "step": "education",
            "quick_replies": [
                "High School / Senior Secondary",
                "Bachelor's Degree (B.Tech / B.Sc / B.A)",
                "Master's Degree (M.Tech / M.Sc / MBA)",
                "Doctorate / Working Professional"
            ],
            "is_final": False,
            "recommendations": []
        }
    elif turn_count == 1:
        text = f"Got it! Building on your **{user_msg}** education background:\n\n**2. What is your main interested field of study or subject area?**"
        payload = {
            "step": "field",
            "quick_replies": [
                "Artificial Intelligence & Machine Learning",
                "Full Stack Web Development",
                "Data Science & Analytics",
                "Cybersecurity & Cloud Computing"
            ],
            "is_final": False,
            "recommendations": []
        }
    elif turn_count == 2:
        text = f"Excellent! Focusing on **{user_msg}** is a great choice.\n\n**3. What is your preferred course duration?**"
        payload = {
            "step": "duration",
            "quick_replies": [
                "Short (1 - 4 weeks crash course)",
                "Medium (1 - 3 months specialized)",
                "Long (3 - 6 months comprehensive)",
                "Self-paced / Flexible schedule"
            ],
            "is_final": False,
            "recommendations": []
        }
    else:
        text = "Thank you! Based on your **highest education**, **interested field of study**, and **preferred course duration**, I have analyzed top global learning platforms to curate **3 ideal course recommendations** tailored specifically for you."
        
        # Tailored mock recommendations based on field of study keywords
        if "machine learning" in msg_lower or "ai" in msg_lower or "data" in msg_lower or "artificial intelligence" in msg_lower:
            recs = [
                {
                    "title": "Machine Learning Specialization by Andrew Ng",
                    "platform": "Coursera / Stanford Online",
                    "skills": ["Python", "Supervised Learning", "Neural Networks", "TensorFlow"],
                    "match_reason": "Matches your interest in AI/Machine Learning and fits standard 2-3 month flexible duration for your education level.",
                    "link": "https://www.coursera.org/specializations/machine-learning-introduction"
                },
                {
                    "title": "Deep Learning Specialization",
                    "platform": "Coursera / DeepLearning.AI",
                    "skills": ["Deep Learning", "CNNs", "Transformers", "PyTorch"],
                    "match_reason": "High-impact specialization matching your target field and preferred timeframe.",
                    "link": "https://www.coursera.org/specializations/deep-learning"
                },
                {
                    "title": "Applied Data Science with Python Specialization",
                    "platform": "edX / University of Michigan",
                    "skills": ["Pandas", "Data Visualization", "Applied ML", "Scikit-Learn"],
                    "match_reason": "Structured project-based learning matching your education level and duration preferences.",
                    "link": "https://www.edx.org/course/applied-data-science-with-python"
                }
            ]
        else:
            recs = [
                {
                    "title": "Meta Front-End Developer Professional Certificate",
                    "platform": "Coursera / Meta",
                    "skills": ["React.js", "JavaScript", "HTML5/CSS3", "UI/UX Principles"],
                    "match_reason": "Tailored for your interested field of study with flexible duration options matching your education background.",
                    "link": "https://www.coursera.org/professional-certificates/meta-front-end-developer"
                },
                {
                    "title": "Google Cloud Associate Cloud Engineer Certificate",
                    "platform": "Coursera / Google Cloud",
                    "skills": ["GCP Infrastructure", "Docker & Kubernetes", "Cloud Security"],
                    "match_reason": "Industry-standard certificate matching your field of interest and preferred course timeframe.",
                    "link": "https://www.coursera.org/professional-certificates/google-cloud-engineering"
                },
                {
                    "title": "CS50's Introduction to Computer Science",
                    "platform": "edX / Harvard University",
                    "skills": ["Algorithms", "Data Structures", "C & Python", "Software Engineering"],
                    "match_reason": "Gold standard foundational program that fits short to medium learning schedules.",
                    "link": "https://www.edx.org/cs50"
                }
            ]

        payload = {
            "step": "recommendation",
            "quick_replies": [
                "Tell me more about Course #1",
                "Restart assessment",
                "Export recommendations"
            ],
            "is_final": True,
            "recommendations": recs
        }

    return text, payload


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.json or {}
    user_message = data.get('message', '').strip()
    history = data.get('history', [])

    if not user_message:
        return jsonify({'error': 'Message cannot be empty'}), 400

    api_key = os.getenv('GEMINI_API_KEY', '').strip()

    if api_key and api_key != 'your_gemini_api_key_here' and GENAI_AVAILABLE:
        try:
            client = genai.Client(api_key=api_key)

            contents = []
            for item in history:
                role = 'user' if item.get('sender') == 'user' else 'model'
                text = item.get('text', '')
                contents.append(types.Content(
                    role=role,
                    parts=[types.Part.from_text(text=text)]
                ))
            
            contents.append(types.Content(
                role='user',
                parts=[types.Part.from_text(text=user_message)]
            ))

            config = types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION,
                tools=[{"google_search": {}}],
                temperature=0.7
            )

            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=contents,
                config=config
            )

            raw_text = response.text or ""
            clean_text, payload = extract_json_payload(raw_text)

            if not payload:
                payload = {
                    "step": "education",
                    "quick_replies": ["Tell me more", "Restart counselor"],
                    "is_final": False,
                    "recommendations": []
                }

            return jsonify({
                'text': clean_text,
                'payload': payload,
                'mode': 'live_gemini'
            })

        except Exception as e:
            print("Gemini API Call Error:", e)
            clean_text, payload = get_mock_response(history, user_message)
            clean_text = f"*(Note: Gemini API Notice - Falling back to local intelligence mode: {str(e)})*\n\n" + clean_text
            return jsonify({
                'text': clean_text,
                'payload': payload,
                'mode': 'fallback_notice'
            })

    clean_text, payload = get_mock_response(history, user_message)
    return jsonify({
        'text': clean_text,
        'payload': payload,
        'mode': 'demo_mode'
    })


if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
