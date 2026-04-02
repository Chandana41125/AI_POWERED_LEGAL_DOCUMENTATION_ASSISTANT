# ==============================================
# LEXIAI - FINAL CLEAN & OPTIMIZED BACKEND (Flask)
# ==============================================
# Handles:
# ✔ Login / Signup (MySQL + Flask-Login)
# ✔ Dashboard
# ✔ Summarizer (PDF/DOCX/TXT)
# ✔ Chatbot (Ollama llama3.2:1b)
# ✔ Draft Downloads
# ✔ Templates + Static fully supported
# ==============================================

from flask import Flask, render_template, request, redirect, url_for, flash, jsonify, send_from_directory, send_file
from flask_login import LoginManager, login_user, login_required, logout_user, current_user, UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
import mysql.connector
import requests
import docx2txt, PyPDF2, os, docx
import logging
from io import BytesIO
from config import Config
import ollama

# ------------------------------------------------
# APP CONFIG
# ------------------------------------------------
app = Flask(__name__, template_folder="templates", static_folder="static")
app.config.from_object(Config)

# ------------------------------------------------
# LOGIN MANAGER
# ------------------------------------------------
login_manager = LoginManager(app)
login_manager.login_view = "login"
login_manager.login_message_category = "info"

# ------------------------------------------------
# MYSQL CONNECTION
# ------------------------------------------------
def get_db_connection():
    return mysql.connector.connect(
        host=app.config["MYSQL_HOST"],
        user=app.config["MYSQL_USER"],
        password=app.config["MYSQL_PASSWORD"],
        database=app.config["MYSQL_DATABASE"],
    )

# ------------------------------------------------
# USER MODEL
# ------------------------------------------------
class User(UserMixin):
    def __init__(self, id, full_name, email, password_hash):
        self.id = str(id)
        self.full_name = full_name
        self.email = email
        self.password_hash = password_hash


def get_user_by_id(user_id):
    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)
    cur.execute("SELECT * FROM users WHERE id = %s", (user_id,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    if row:
        return User(row["id"], row["full_name"], row["email"], row["password"])
    return None


def get_user_by_email(email):
    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)
    cur.execute("SELECT * FROM users WHERE email = %s", (email,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    if row:
        return User(row["id"], row["full_name"], row["email"], row["password"])
    return None


@login_manager.user_loader
def load_user(user_id):
    return get_user_by_id(user_id)

logging.basicConfig(level=logging.INFO)

# ------------------------------------------------
# OLLAMA ENGINE (CHATBOT + SUMMARY + TRANSLATION)
# ------------------------------------------------
OLLAMA_URL = os.getenv("OLLAMA_URL")  # kept for backward compatibility if needed


def call_ollama(prompt: str, system: str | None = None, model: str = "llama3.2:1b") -> str | None:
    """Generic helper to call the local Ollama server via the Python client.

    Uses ollama.chat with optional system + user messages and returns the
    response text, or None on error.
    """

    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    try:
        response = ollama.chat(model=model, messages=messages)
        content = response.get("message", {}).get("content", "").strip()
        if not content:
            logging.error("Ollama chat returned empty content: %s", response)
            return None
        return content
    except Exception as e:
        logging.exception("Error while calling Ollama chat: %s", e)
        return None


def ollama_generate(prompt):
    """Backward-compatible wrapper used by existing chatbot/summary calls."""
    result = call_ollama(prompt)
    if not result:
        return "Error contacting AI model. Please check server logs."
    return result


SUPPORTED_LANGUAGES = {
    "english": "English",
    "kannada": "Kannada",
    "hindi": "Hindi",
    "telugu": "Telugu",
    "tamil": "Tamil",
}


def translate_summary(summary_text: str, target_lang_key: str) -> str:
    """Translate an English bullet summary into the requested language.

    target_lang_key is one of 'english', 'kannada', 'hindi', 'telugu', 'tamil'.
    """

    if not summary_text.strip():
        return "Summary could not be generated, so translation is not available."

    target_lang_name = SUPPORTED_LANGUAGES.get(target_lang_key.lower())
    if not target_lang_name:
        return "Selected language is not supported."

    # English → no translation needed
    if target_lang_name == "English":
        return summary_text

    system_prompt = "You are a legal document assistant and native-level translator."
    user_prompt = (
        f"Translate the following bullet summary to {target_lang_name}. "
        f"Maintain bullet formatting and keep it professional:\n\n{summary_text}"
    )

    translated_text = call_ollama(user_prompt, system=system_prompt)
    if not translated_text:
        return "Translation failed due to model error. Make sure Ollama is running and the model is installed."
    return translated_text

def extract_text(path):
    ext = path.split(".")[-1].lower()

    if ext == "pdf":
        reader = PyPDF2.PdfReader(open(path, "rb"))
        return "\n".join(page.extract_text() or "" for page in reader.pages)

    elif ext == "docx":
        return docx2txt.process(path)

    elif ext == "txt":
        return open(path, "r", encoding="utf-8").read()

    return ""


def extract_text_from_upload(file_storage):
    """Extract plain text from an uploaded file (PDF/DOCX/TXT).

    Returns a stripped string. If extraction fails or yields no text,
    returns an empty string and logs the problem.
    """

    filename = getattr(file_storage, "filename", "") or ""
    _, ext = os.path.splitext(filename)
    ext = ext.lower()

    try:
        # Ensure uploads directory exists
        app.config["UPLOAD_FOLDER"] = "uploads"
        safe_name = secure_filename(filename) or "upload.tmp"
        path = os.path.join(app.config["UPLOAD_FOLDER"], safe_name)
        file_storage.save(path)

        text = ""
        if ext == ".pdf":
            logging.info("Extracting text from PDF: %s", filename)
            with open(path, "rb") as f:
                reader = PyPDF2.PdfReader(f)
                pages = []
                for page in reader.pages:
                    page_text = page.extract_text() or ""
                    pages.append(page_text)
                text = "\n".join(pages)

        elif ext == ".docx":
            logging.info("Extracting text from DOCX: %s", filename)
            text = docx2txt.process(path) or ""

        elif ext == ".txt":
            logging.info("Extracting text from TXT: %s", filename)
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                text = f.read()

        else:
            logging.warning("Unsupported file extension for summary: %s", ext)
            text = ""

        if not text or not text.strip():
            logging.warning("No text extracted from file: %s", filename)
            return ""

        return text.strip()

    except Exception:
        logging.exception("Error extracting text from upload: %s", filename)
        return ""


def _chunk_text(text, max_chars=3500):
    """Split long text into chunks near paragraph boundaries."""
    paragraphs = text.split("\n\n")
    chunks = []
    current = ""

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
        if len(current) + len(para) + 2 > max_chars and current:
            chunks.append(current.strip())
            current = para
        else:
            if current:
                current += "\n\n" + para
            else:
                current = para

    if current.strip():
        chunks.append(current.strip())

    return chunks

# ------------------------------------------------
# PDF & DOCX EXPORT
# ------------------------------------------------
def pdf_file(content):
    buf = BytesIO()
    from reportlab.pdfgen import canvas
    c = canvas.Canvas(buf)
    text = c.beginText(40, 800)
    for line in content.split("\n"):
        text.textLine(line)
    c.drawText(text)
    c.save()
    buf.seek(0)
    return buf


def docx_file(content):
    buf = BytesIO()
    d = docx.Document()
    for line in content.split("\n"):
        d.add_paragraph(line)
    d.save(buf)
    buf.seek(0)
    return buf

# ------------------------------------------------
# ROUTES
# ------------------------------------------------
@app.route("/")
def home():
    return render_template("index.html")

# --------------------- SIGNUP ---------------------
@app.route("/signup", methods=["GET", "POST"])
def signup():
    if request.method == "POST":
        full_name = (request.form.get("full_name") or "").strip()
        email = (request.form.get("email") or "").strip().lower()
        password = request.form.get("password") or ""

        # Basic validation
        if not full_name or not email or not password:
            flash("All fields are required.", "error")
            return render_template("signup.html", full_name=full_name, email=email)

        # Existing user check
        if get_user_by_email(email):
            flash("Email already registered.", "error")
            return render_template("signup.html", full_name=full_name, email=email)

        hash_pw = generate_password_hash(password)

        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO users (full_name, email, password) VALUES (%s, %s, %s)",
            (full_name, email, hash_pw),
        )
        conn.commit()
        cur.close()
        conn.close()

        flash("Signup successful! You can now login to enjoy our website.", "success")
        return redirect(url_for("login"))

    return render_template("signup.html")

# --------------------- LOGIN ----------------------
@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        email = (request.form.get("email") or "").strip().lower()
        password = request.form.get("password") or ""

        # Empty-field validation uses the same generic error for security
        if not email or not password:
            flash("Invalid username or password.", "error")
            return render_template("login.html", email=email)

        user = get_user_by_email(email)

        if user and check_password_hash(user.password_hash, password):
            login_user(user)
            flash("Login successful! Redirecting...", "success")
            return redirect(url_for("dashboard"))

        # Wrong credentials: do not clear email, but password will not be re-populated
        flash("Invalid username or password.", "error")
        return render_template("login.html", email=email)

    return render_template("login.html")

# -------------------- LOGOUT ----------------------
@app.route("/logout")
@login_required
def logout():
    logout_user()
    return redirect(url_for("home"))

# ------------------- DASHBOARD ---------------------
@app.route("/dashboard")
@login_required
def dashboard():
    return render_template("dashboard.html")

# ------------------- SUMMARIZER --------------------
@app.route("/summary", methods=["GET", "POST"])
@login_required
def summary():
    bullet = translated = error_msg = ""
    selected_language_key = "english"
    selected_language_name = SUPPORTED_LANGUAGES["english"]

    if request.method == "POST":
        f = request.files["document"]
        selected_language_key = request.form.get("output_language", "english").lower()
        selected_language_name = SUPPORTED_LANGUAGES.get(selected_language_key, "English")

        text = extract_text_from_upload(f)

        filename = getattr(f, "filename", "") or ""
        _, ext = os.path.splitext(filename)
        ext = ext.lower()

        # Text extraction failure or too-short content
        if not text:
            if ext not in [".pdf", ".docx", ".txt"]:
                error_msg = "Unsupported or corrupted file format."
            else:
                error_msg = "Could not extract content — file may be scanned."
        elif len(text) < 50:
            logging.warning("Extracted text too short (len=%d) for file: %s", len(text), filename)
            error_msg = "Could not extract readable text from this file. It may be scanned or image-based."
        else:
            logging.info(
                "Generating summary: filename=%s ext=%s text_len=%d",
                filename,
                ext,
                len(text),
            )

            # Handle long documents via chunking
            if len(text) > 10000:
                chunks = _chunk_text(text)
                partial_summaries = []
                for idx, chunk in enumerate(chunks, start=1):
                    logging.info(
                        "Calling Ollama for chunk %d/%d (len=%d)",
                        idx,
                        len(chunks),
                        len(chunk),
                    )
                    part = ollama_generate(
                        f"Summarize the following part of a document into bullet points:\n\n{chunk}"
                    )
                    if part.startswith("Ollama is running but didn't respond") or part.startswith(
                        "Error contacting AI model"
                    ):
                        # Treat failures during chunking as a document-size related issue
                        logging.warning("Chunk summarization failed: %s", part)
                        error_msg = "Document too large — summarization incomplete."
                        break
                    partial_summaries.append(part)

                if not error_msg and partial_summaries:
                    combined_prompt = (
                        "Combine and refine the following partial bullet-point summaries into one concise bullet summary:\n\n"
                        + "\n\n".join(partial_summaries)
                    )
                    bullet = ollama_generate(combined_prompt)
                    if bullet.startswith("Ollama is running but didn't respond") or bullet.startswith(
                        "Error contacting AI model"
                    ):
                        logging.warning("Final combination summarization failed: %s", bullet)
                        error_msg = "Document too large — summarization incomplete."
                        bullet = ""
            else:
                bullet = ollama_generate(f"Summarize into clean bullet points:\n{text}")
                if bullet.startswith("Ollama is running but didn't respond") or bullet.startswith(
                    "Error contacting AI model"
                ):
                    # Propagate Ollama-specific issues directly to the user
                    error_msg = bullet
                    bullet = ""

            # Only translate if we have a real English summary and no error
            if bullet and not error_msg:
                try:
                    translated = translate_summary(bullet, selected_language_key)
                except Exception as e:
                    logging.exception(e)
                    translated = "Summary could be generated, but translation failed. Please check server logs."
            elif error_msg:
                translated = "Summary could not be generated, so translation is not available."

    return render_template(
        "summary.html",
        bullet=bullet,
        translated=translated,
        selected_language=selected_language_name,
        selected_language_key=selected_language_key,
        error_msg=error_msg,
    )

# ---- Download summary PDF
@app.route("/download/pdf", methods=["POST"])
def dl_pdf():
    content = request.form["content"]
    return send_file(pdf_file(content), as_attachment=True, download_name="summary.pdf")

# ---- Download summary DOCX
@app.route("/download/docx", methods=["POST"])
def dl_docx():
    content = request.form["content"]
    return send_file(docx_file(content), as_attachment=True, download_name="summary.docx")

# --------------------- CHATBOT --------------------
@app.route("/chat", methods=["POST"])
def chat():
    msg = request.json.get("msg", "")
    prompt = f"User: {msg}\nAI:"
    reply = ollama_generate(prompt)
    return jsonify({"reply": reply})

@app.route("/chatbot")
@login_required
def chatbot():
    return render_template("chatbot.html")


# ---------------------- DRAFTS --------------------
DRAFT_PATH = os.path.join("static", "drafts")

@app.route("/drafts")
@login_required
def drafts():
    # Get all files from static/drafts
    files = os.listdir(DRAFT_PATH) if os.path.exists(DRAFT_PATH) else []

    pairs = {}

    for f in files:
        name, ext = os.path.splitext(f)
        ext = ext.lower()

        if ext in [".pdf", ".docx"]:

            # CLEAN FILE NAME
            clean = name.replace("_", " ").replace("-", " ")

            # remove digits like 5, 10, 3 etc.
            import re
            clean = re.sub(r"\b\d+\b", "", clean)

            # remove words: page, pages, Page, Pages
            clean = clean.replace("pages", "")
            clean = clean.replace("page", "")
            clean = clean.replace("Page", "")
            clean = clean.replace("Pages", "")
            clean = clean.replace("PAGES", "")

            # fix double spaces
            clean = clean.replace("  ", " ").strip()

            # Proper title case
            clean = clean.title()

            # Organize PDF + DOCX under same clean name
            pairs.setdefault(clean, {"pdf": None, "docx": None})

            if ext == ".pdf":
                pairs[clean]["pdf"] = f
            else:
                pairs[clean]["docx"] = f

    return render_template("drafts.html", pairs=pairs)


@app.route("/download/<filename>")
def download_draft(filename):
    return send_from_directory(DRAFT_PATH, filename, as_attachment=True)



# ---------------------- START SERVER --------------------
if __name__ == "__main__":
    app.run(debug=False, host="127.0.0.1", port=5000)
