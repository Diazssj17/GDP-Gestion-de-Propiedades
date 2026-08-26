from app import app as application
from database import crear_tablas

crear_tablas()

if __name__ == "__main__":
    application.run()
