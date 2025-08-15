#!/bin/bash

# Note Management App Setup Script
# This script helps set up the application for development or production

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}  Note Management App Setup${NC}"
    echo -e "${BLUE}================================${NC}"
    echo
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

check_requirements() {
    print_info "Checking system requirements..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 16+ from https://nodejs.org/"
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 16 ]; then
        print_error "Node.js version $NODE_VERSION is not supported. Please install Node.js 16 or higher."
        exit 1
    fi
    print_success "Node.js $(node -v) is installed"
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm."
        exit 1
    fi
    print_success "npm $(npm -v) is installed"
    
    # Check git (optional)
    if command -v git &> /dev/null; then
        print_success "Git $(git --version | cut -d' ' -f3) is installed"
    else
        print_warning "Git is not installed (optional for development)"
    fi
}

setup_environment() {
    print_info "Setting up environment configuration..."
    
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            cp .env.example .env
            print_success "Created .env file from .env.example"
            print_warning "Please edit .env file with your configuration"
        else
            print_error ".env.example file not found"
            exit 1
        fi
    else
        print_success ".env file already exists"
    fi
}

install_dependencies() {
    print_info "Installing backend dependencies..."
    npm install
    print_success "Backend dependencies installed"
    
    print_info "Installing frontend dependencies..."
    cd frontend
    npm install
    cd ..
    print_success "Frontend dependencies installed"
}

setup_database() {
    print_info "Setting up database..."
    
    # Create database directory if it doesn't exist
    mkdir -p database
    
    # Initialize database
    npm run db:init
    print_success "Database initialized"
    
    # Run migrations
    npm run db:migrate
    print_success "Database migrations completed"
}

validate_setup() {
    print_info "Validating configuration..."
    
    if npm run validate:config; then
        print_success "Configuration validation passed"
    else
        print_error "Configuration validation failed"
        print_info "Please check your .env file and fix any issues"
        exit 1
    fi
}

create_directories() {
    print_info "Creating necessary directories..."
    
    mkdir -p logs
    mkdir -p data
    
    print_success "Directories created"
}

print_completion() {
    echo
    print_success "Setup completed successfully!"
    echo
    print_info "Next steps:"
    echo "  1. Edit .env file with your configuration"
    echo "  2. For development: npm run dev"
    echo "  3. For production: npm run start:prod"
    echo
    print_info "Available commands:"
    echo "  npm run dev          - Start development server"
    echo "  npm run dev:debug    - Start with debug logging"
    echo "  npm test             - Run tests"
    echo "  npm run build        - Build frontend"
    echo "  npm run validate:config - Validate configuration"
    echo
    print_info "For more information, see DEPLOYMENT.md"
}

# Main execution
main() {
    print_header
    
    # Parse command line arguments
    SKIP_DEPS=false
    SKIP_DB=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-deps)
                SKIP_DEPS=true
                shift
                ;;
            --skip-db)
                SKIP_DB=true
                shift
                ;;
            --help|-h)
                echo "Usage: $0 [OPTIONS]"
                echo "Options:"
                echo "  --skip-deps    Skip dependency installation"
                echo "  --skip-db      Skip database setup"
                echo "  --help, -h     Show this help message"
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done
    
    # Run setup steps
    check_requirements
    setup_environment
    create_directories
    
    if [ "$SKIP_DEPS" = false ]; then
        install_dependencies
    else
        print_warning "Skipping dependency installation"
    fi
    
    if [ "$SKIP_DB" = false ]; then
        setup_database
    else
        print_warning "Skipping database setup"
    fi
    
    validate_setup
    print_completion
}

# Run main function
main "$@"