import os
import logging
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import DeclarativeBase
from werkzeug.middleware.proxy_fix import ProxyFix


# Configure logging
logging.basicConfig(level=logging.DEBUG)

class Base(DeclarativeBase):
    pass


db = SQLAlchemy(model_class=Base)
# create the app
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "dev_secret_key")
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)  # needed for url_for to generate with https

# configure the database using the PostgreSQL connection from environment variables
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get("DATABASE_URL")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_recycle": 300,
    "pool_pre_ping": True,
}

# initialize the app with the extension, flask-sqlalchemy >= 3.0.x
db.init_app(app)

with app.app_context():
    # Import the models here for table creation
    import models  # noqa: F401

    db.create_all()
    
    # Import sample data population function
    from models import populate_sample_data
    
    # Add sample data
    populate_sample_data()

    # Import and register blueprints
    from routes.inventory import inventory_bp
    from routes.checkout import checkout_bp
    from routes.reports import reports_bp
    
    app.register_blueprint(inventory_bp)
    app.register_blueprint(checkout_bp)
    app.register_blueprint(reports_bp)

    # Import and register the main routes - directly import the module
    import routes
