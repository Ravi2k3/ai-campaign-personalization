import os, logging, axiom_py
from axiom_py.logging import AxiomHandler
from dotenv import load_dotenv

load_dotenv()

def setup_logger(name: str = "app") -> logging.Logger:
    """
    Set up a logger with both Axiom (cloud) and console handlers.
    
    Args:
        name: The name of the logger (default: "app")
    
    Returns:
        A configured logger instance
    """
    logger = logging.getLogger(name)
    
    # Avoid adding duplicate handlers
    if logger.handlers:
        return logger
    
    logger.setLevel(logging.INFO)
    
    # Axiom handler (cloud) - only if token is configured
    axiom_token = os.getenv("AXIOM_TOKEN")
    axiom_dataset = os.getenv("AXIOM_DATASET")
    
    if axiom_token:
        try:
            client = axiom_py.Client(axiom_token)
            axiom_handler = AxiomHandler(client, axiom_dataset) # type: ignore
            axiom_handler.setLevel(logging.INFO)
            logger.addHandler(axiom_handler)
            logger.info(f"Axiom logging enabled for dataset: {axiom_dataset}")
        except Exception as e:
            print(f"Warning: Failed to initialize Axiom logging: {e}")
    
    # Console handler (local dev + fallback)
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.DEBUG)
    console_handler.setFormatter(logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    ))
    logger.addHandler(console_handler)
    
    return logger


# Create a default logger instance
logger = setup_logger()